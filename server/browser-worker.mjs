import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { BrowserSessionManager } from "./browser-runtime.mjs";
import { createRequestLimiter } from "./request-limiter.mjs";
import { createLocalEgressProxy } from "./egress-proxy.mjs";

const host = process.env.BROWSER_AGENT_HOST || "127.0.0.1";
const port = Number(process.env.BROWSER_AGENT_PORT || 8788);
const token = (process.env.BROWSER_AGENT_TOKEN || "").trim();
const MAX_ACTIVE_SESSIONS = 4;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function send(res, status, payload) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  });
  res.end(JSON.stringify(payload));
}

function readJson(req, maxBytes = 300 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    req.on("data", chunk => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += bytes.length;
      if (byteLength > maxBytes) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(bytes);
    });
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks, byteLength).toString("utf8");
        resolve(body ? JSON.parse(body) : {});
      }
      catch { reject(Object.assign(new Error("Invalid JSON body"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function tokenMatches(req, expectedDigest) {
  const header = req.headers.authorization;
  const candidate = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const sameDigest = timingSafeEqual(candidateDigest, expectedDigest);
  return sameDigest && candidate.length === token.length;
}

async function main() {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("BROWSER_AGENT_PORT must be between 1 and 65535");
  if (!LOOPBACK_HOSTS.has(host) && process.env.BROWSER_AGENT_ALLOW_REMOTE !== "true") {
    throw new Error("Browser Agent must bind to loopback unless BROWSER_AGENT_ALLOW_REMOTE=true is explicitly set behind a trusted TLS reverse proxy and firewall");
  }
  if (!LOOPBACK_HOSTS.has(host)) process.stderr.write("Warning: remote Browser Agent access is enabled; enforce TLS, network filtering, and a dedicated secret at the reverse proxy.\n");
  if (!token || token.length < 32 || /^(replace|change|your|example)[-_]/i.test(token)) {
    throw new Error("Configure BROWSER_AGENT_TOKEN with a random, non-placeholder secret of at least 32 characters");
  }
  const expectedTokenDigest = createHash("sha256").update(token).digest();
  const limiter = createRequestLimiter({ limits: { read: 240, write: 60 }, maxEntries: 10_000 });
  const { chromium } = await import("playwright");
  const egressProxy = createLocalEgressProxy();
  const egressProxyUrl = await egressProxy.listen();
  const manager = new BrowserSessionManager({ chromium, egressProxyUrl });
  let pendingSessionCreations = 0;
  let stopping = false;

  const server = createServer(async (req, res) => {
    try {
      const requestClass = req.method === "GET" || req.method === "HEAD" ? "read" : "write";
      const ipKey = `${req.socket.remoteAddress || "unknown"}:${requestClass}`;
      const rate = limiter.consume(ipKey, requestClass);
      if (!rate.allowed) {
        res.setHeader("retry-after", String(rate.retryAfterSeconds));
        return send(res, 429, { error: "Browser worker request limit reached" });
      }
      // The worker is an internal service, not a browser-facing API. Do not permit CORS or preflight.
      if (req.headers.origin || req.method === "OPTIONS") return send(res, 403, { error: "Browser worker is not available to browser origins" });

      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, { ok: true, service: "maaroof-browser-agent", engine: "playwright-chromium", egress: "loopback-ip-pinned-connect" });
      }
      if (!tokenMatches(req, expectedTokenDigest)) return send(res, 401, { error: "Unauthorized" });
      if (req.method === "OPTIONS") return send(res, 405, { error: "Method not allowed" });

      const collection = url.pathname.match(/^\/internal\/workspaces\/([^/]+)\/sessions$/);
      if (collection && req.method === "POST") {
        await manager.closeExpired();
        if (manager.sessions.size + pendingSessionCreations >= MAX_ACTIVE_SESSIONS) {
          return send(res, 429, { error: "The browser worker has reached its active session limit" });
        }
        pendingSessionCreations += 1;
        try {
          const body = await readJson(req);
          const session = await manager.create({
            workspaceId: decodeURIComponent(collection[1]),
            destinationId: body.destinationId,
            startUrl: body.startUrl,
            approvedHosts: body.approvedHosts
          });
          return send(res, 201, { session });
        } finally {
          pendingSessionCreations -= 1;
        }
      }
      const item = url.pathname.match(/^\/internal\/workspaces\/([^/]+)\/sessions\/([^/]+)(?:\/(screenshot|actions|fill-article))?$/);
      if (!item) return send(res, 404, { error: "Route not found" });
      const workspaceId = decodeURIComponent(item[1]);
      const sessionId = decodeURIComponent(item[2]);
      const action = item[3] || "";
      if (!action && req.method === "GET") return send(res, 200, { session: await manager.status(sessionId, workspaceId) });
      if (action === "screenshot" && req.method === "GET") return send(res, 200, await manager.screenshot(sessionId, workspaceId));
      if (action === "actions" && req.method === "POST") return send(res, 200, { session: await manager.act(sessionId, workspaceId, await readJson(req)) });
      if (action === "fill-article" && req.method === "POST") return send(res, 200, { session: await manager.fillArticle(sessionId, workspaceId, await readJson(req)) });
      if (!action && req.method === "DELETE") return send(res, 200, await manager.close(sessionId, workspaceId));
      return send(res, 405, { error: "Method not allowed" });
    } catch (error) {
      return send(res, error.status || 500, { error: error.message || "Browser worker error" });
    }
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.listen(port, host, () => {
    process.stdout.write(`Browser Agent listening on http://${host}:${port}\n`);
  });
  const cleanup = setInterval(() => { void manager.closeExpired(); }, 30_000);
  cleanup.unref();
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(cleanup);
    await Promise.all([...manager.sessions.values()].map(session => manager.close(session.id, session.workspaceId)));
    await egressProxy.close();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch(error => {
  process.stderr.write(`Browser Agent failed to start: ${error.message}\n`);
  process.exitCode = 1;
});
