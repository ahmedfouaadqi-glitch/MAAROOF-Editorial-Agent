import { PassThrough } from "node:stream";
import { connect as tcpConnect } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalEgressProxy, resolvePinnedTarget } from "./egress-proxy.mjs";

const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];

describe("IP-pinned local egress proxy", () => {
  it("resolves once and returns a literal public address for the TCP connection", async () => {
    const resolveHost = vi.fn(publicDns);
    await expect(resolvePinnedTarget("publisher.example:443", { resolveHost })).resolves.toEqual({
      hostname: "publisher.example", port: 443, address: "93.184.216.34"
    });
    expect(resolveHost).toHaveBeenCalledOnce();
    expect(resolveHost).toHaveBeenCalledWith("publisher.example", { all: true, verbatim: true });
  });

  it("rejects private or mixed DNS answers, private IP literals, and non-443 ports", async () => {
    const mixedDns = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 }
    ];
    await expect(resolvePinnedTarget("publisher.example:443", { resolveHost: mixedDns })).rejects.toMatchObject({ status: 403 });
    await expect(resolvePinnedTarget("127.0.0.1:443")).rejects.toMatchObject({ status: 403 });
    await expect(resolvePinnedTarget("publisher.example:8443", { resolveHost: publicDns })).rejects.toMatchObject({ status: 403 });
    await expect(resolvePinnedTarget("publisher.example:443", { resolveHost: async () => { throw new Error("dns failure"); } })).rejects.toMatchObject({ status: 502 });
  });

  it("binds only to loopback and rejects non-loopback configuration", () => {
    expect(() => createLocalEgressProxy({ host: "0.0.0.0" })).toThrow(/loopback only/);
  });

  it("opens CONNECT using the resolved IP literal and tunnels bytes without re-resolving the hostname", async () => {
    let proxy;
    let client;
    let connectedTarget;
    const connectImpl = vi.fn(options => {
      connectedTarget = options;
      const stream = new PassThrough();
      queueMicrotask(() => stream.emit("connect"));
      return stream;
    });
    proxy = createLocalEgressProxy({ resolveHost: publicDns, connectImpl });
    const origin = await proxy.listen();
    const proxyPort = Number(new URL(origin).port);

    try {
      const echoed = await new Promise((resolve, reject) => {
        client = tcpConnect(proxyPort, "127.0.0.1");
        client.setTimeout(3_000, () => reject(new Error("CONNECT proxy test timed out")));
        let received = "";
        let sentPayload = false;
        client.on("error", reject);
        client.on("connect", () => client.write("CONNECT publisher.example:443 HTTP/1.1\r\nHost: publisher.example:443\r\n\r\n"));
        client.on("data", chunk => {
          received += chunk.toString("utf8");
          if (!sentPayload && received.includes("\r\n\r\n")) {
            expect(received).toContain("HTTP/1.1 200 Connection Established");
            sentPayload = true;
            client.write("pinned-tunnel-check");
          }
          if (sentPayload && received.includes("pinned-tunnel-check")) resolve(received);
        });
      });
      expect(echoed).toContain("pinned-tunnel-check");
      expect(connectImpl).toHaveBeenCalledOnce();
      expect(connectedTarget).toEqual({ host: "93.184.216.34", port: 443 });
    } finally {
      client?.destroy();
      await proxy.close();
    }
  });

  it("rejects CONNECT requests for unapproved ports before opening a socket", async () => {
    let client;
    const connectImpl = vi.fn();
    const proxy = createLocalEgressProxy({ resolveHost: publicDns, connectImpl });
    const origin = await proxy.listen();
    try {
      const response = await new Promise<string>((resolve, reject) => {
        client = tcpConnect(Number(new URL(origin).port), "127.0.0.1");
        client.setTimeout(3_000, () => reject(new Error("CONNECT proxy test timed out")));
        let text = "";
        client.on("error", reject);
        client.on("connect", () => client.write("CONNECT publisher.example:8443 HTTP/1.1\r\nHost: publisher.example:8443\r\n\r\n"));
        client.on("data", chunk => { text += chunk.toString("utf8"); if (text.includes("\r\n\r\n")) resolve(text); });
      });
      expect(response).toContain("HTTP/1.1 403 Forbidden");
      expect(connectImpl).not.toHaveBeenCalled();
    } finally {
      client?.destroy();
      await proxy.close();
    }
  });
});
