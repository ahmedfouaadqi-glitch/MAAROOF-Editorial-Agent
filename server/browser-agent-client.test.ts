import { describe, expect, it, vi } from "vitest";
import { createBrowserAgentClient } from "./browser-agent-client.mjs";

const token = "x".repeat(40);

describe("browser agent client", () => {
  it("requires a strong shared secret only when making a request", async () => {
    const request = createBrowserAgentClient({ token: "short", fetchImpl: vi.fn() });
    await expect(request("/internal/workspaces/w/sessions")).rejects.toMatchObject({ status: 503 });
  });

  it("allows HTTP only for loopback workers", () => {
    expect(() => createBrowserAgentClient({ baseUrl: "http://browser.internal:8788", token })).toThrow(/HTTPS/);
    expect(() => createBrowserAgentClient({ baseUrl: "http://127.0.0.1:8788", token })).not.toThrow();
    expect(() => createBrowserAgentClient({ baseUrl: "https://browser.example", token })).not.toThrow();
  });

  it("sends the shared secret and only returns the worker payload", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ session: { id: "s1" } }), {
      status: 201, headers: { "content-type": "application/json" }
    }));
    const request = createBrowserAgentClient({ baseUrl: "http://127.0.0.1:8788", token, fetchImpl });
    const result = await request("/internal/workspaces/main/sessions", {
      method: "POST", body: { destinationId: "d1", startUrl: "https://site.example/login" }
    });
    expect(result).toEqual({ session: { id: "s1" } });
    const [url, options] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("http://127.0.0.1:8788/internal/workspaces/main/sessions");
    expect(new Headers(options.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(options.body).toBe(JSON.stringify({ destinationId: "d1", startUrl: "https://site.example/login" }));
  });

  it("does not expose worker error status as a publish success", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "Blocked URL" }), {
      status: 403, headers: { "content-type": "application/json" }
    }));
    const request = createBrowserAgentClient({ token, fetchImpl });
    await expect(request("/internal/workspaces/main/sessions")).rejects.toMatchObject({ message: "Blocked URL", status: 403 });
  });
});
