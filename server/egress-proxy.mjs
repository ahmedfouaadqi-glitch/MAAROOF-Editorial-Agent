import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { connect, isIP } from "node:net";
import { isPublicIp } from "./browser-runtime.mjs";

function proxyError(message, status = 403) {
  return Object.assign(new Error(message), { status });
}

function parseConnectAuthority(authority) {
  if (typeof authority !== "string" || !authority || authority.length > 320) {
    throw proxyError("Invalid CONNECT authority", 400);
  }
  let url;
  try { url = new URL(`https://${authority}`); }
  catch { throw proxyError("Invalid CONNECT authority", 400); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || url.hostname.includes("*") || (url.port && url.port !== "443")) {
    throw proxyError("The egress proxy only permits HTTPS CONNECT on port 443", 403);
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) throw proxyError("CONNECT hostname is required", 400);
  return { hostname, port: 443 };
}

export async function resolvePinnedTarget(authority, { resolveHost = lookup } = {}) {
  const target = parseConnectAuthority(authority);
  if (isIP(target.hostname)) {
    if (!isPublicIp(target.hostname)) throw proxyError("Private or reserved IP targets are blocked", 403);
    return { ...target, address: target.hostname };
  }

  let addresses;
  try { addresses = await resolveHost(target.hostname, { all: true, verbatim: true }); }
  catch { throw proxyError("Destination DNS resolution failed; connection was blocked", 502); }
  if (!Array.isArray(addresses) || addresses.length === 0
    || addresses.some(entry => !entry || typeof entry.address !== "string" || !isPublicIp(entry.address))) {
    throw proxyError("Destination resolves to a private or reserved IP; connection was blocked", 403);
  }
  return { ...target, address: addresses[0].address };
}

function rejectSocket(socket, status, message) {
  if (socket.destroyed) return;
  const phrase = status === 400 ? "Bad Request" : status === 502 ? "Bad Gateway" : status === 503 ? "Service Unavailable" : "Forbidden";
  const body = `${message}\n`;
  socket.end(`HTTP/1.1 ${status} ${phrase}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

export function createLocalEgressProxy({ resolveHost = lookup, connectImpl = connect, host = "127.0.0.1", port = 0, maxTunnels = 128 } = {}) {
  if (host !== "127.0.0.1") throw new Error("The egress proxy must bind to IPv4 loopback only.");
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) throw new Error("Egress proxy port must be between 0 and 65535.");
  if (!Number.isSafeInteger(maxTunnels) || maxTunnels < 1 || maxTunnels > 1024) throw new Error("Egress proxy tunnel limit is invalid.");

  let activeTunnels = 0;
  const server = createServer((req, res) => {
    res.writeHead(405, { "connection": "close", "content-type": "text/plain; charset=utf-8" });
    res.end("CONNECT required\n");
  });
  server.maxConnections = maxTunnels;
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;

  server.on("connect", async (req, clientSocket, head) => {
    if (activeTunnels >= maxTunnels) return rejectSocket(clientSocket, 503, "Egress proxy tunnel capacity reached");
    activeTunnels += 1;
    let upstream;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeTunnels = Math.max(0, activeTunnels - 1);
    };
    clientSocket.once("close", release);
    try {
      const target = await resolvePinnedTarget(req.url, { resolveHost });
      if (clientSocket.destroyed) { release(); return; }
      upstream = connectImpl({ host: target.address, port: target.port });
      upstream.setTimeout?.(10_000, () => upstream.destroy(new Error("Upstream connection timed out")));
      upstream.once("connect", () => {
        upstream.setTimeout?.(0);
        if (clientSocket.destroyed) { upstream.destroy(); release(); return; }
        clientSocket.write("HTTP/1.1 200 Connection Established\r\nProxy-Agent: EditorialAgentEgress\r\n\r\n");
        if (head?.length) upstream.write(head);
        clientSocket.pipe(upstream);
        upstream.pipe(clientSocket);
      });
      upstream.once("error", error => {
        if (!clientSocket.destroyed && !clientSocket.writableEnded) {
          rejectSocket(clientSocket, 502, error.message === "Upstream connection timed out" ? "Upstream connection timed out" : "Pinned destination connection failed");
        }
        upstream.destroy();
        release();
      });
      upstream.once("close", release);
      clientSocket.once("error", () => upstream?.destroy());
    } catch (error) {
      rejectSocket(clientSocket, error?.status || 502, error?.message || "Egress proxy request failed");
      upstream?.destroy();
      release();
    }
  });

  return {
    server,
    async listen() {
      if (server.listening) throw new Error("Egress proxy is already listening.");
      await new Promise((resolveListen, reject) => {
        const onError = error => { server.off("listening", onListening); reject(error); };
        const onListening = () => { server.off("error", onError); resolveListen(); };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Egress proxy did not bind to a TCP port.");
      return `http://127.0.0.1:${address.port}`;
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    },
    get activeTunnels() { return activeTunnels; }
  };
}
