import { createServer } from "node:http";
import { BrowserSessionManager } from "./browser-runtime.mjs";

const host = process.env.BROWSER_AGENT_HOST || "127.0.0.1";
const port = Number(process.env.BROWSER_AGENT_PORT || 8788);
const token = process.env.BROWSER_AGENT_TOKEN || "";

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}
function readJson(req, maxBytes = 300 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(Object.assign(new Error("Invalid JSON body"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
function requireWorker(req) {
  if (!token || token.length < 32) throw Object.assign(new Error("BROWSER_AGENT_TOKEN must be a 32+ character secret"), { status: 503 });
  if (req.headers.authorization !== `Bearer ${token}`) throw Object.assign(new Error("Unauthorized"), { status: 401 });
}

async function main() {
  if (!token || token.length < 32) throw new Error("Configure BROWSER_AGENT_TOKEN with at least 32 random characters");
  const { chromium } = await import("playwright");
  const manager = new BrowserSessionManager({ chromium });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "maaroof-browser-agent", engine: "playwright-chromium" });
      requireWorker(req);
      const collection = url.pathname.match(/^\/internal\/workspaces\/([^/]+)\/sessions$/);
      if (collection && req.method === "POST") {
        const body = await readJson(req);
        const session = await manager.create({
          workspaceId: decodeURIComponent(collection[1]),
          destinationId: body.destinationId,
          startUrl: body.startUrl,
          approvedHosts: body.approvedHosts
        });
        return send(res, 201, { session });
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
  server.listen(port, host, () => {
    process.stdout.write(`Browser Agent listening on http://${host}:${port}\n`);
  });
  const cleanup = setInterval(() => { void manager.closeExpired(); }, 30_000);
  cleanup.unref();
  const stop = async () => {
    clearInterval(cleanup);
    await Promise.all([...manager.sessions.values()].map(session => manager.close(session.id, session.workspaceId)));
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch(error => {
  process.stderr.write(`Browser Agent failed to start: ${error.message}\n`);
  process.exitCode = 1;
});
