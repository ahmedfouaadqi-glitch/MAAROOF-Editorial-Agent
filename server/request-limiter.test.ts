import { describe, expect, it } from "vitest";
import { createRequestLimiter } from "./request-limiter.mjs";

describe("in-memory request limiter", () => {
  it("applies separate per-key buckets and resets at the window boundary", () => {
    let now = 1_000;
    const limiter = createRequestLimiter({ windowMs: 10_000, limits: { read: 2, write: 1 }, maxEntries: 4, now: () => now });
    expect(limiter.consume("127.0.0.1:read", "read").allowed).toBe(true);
    expect(limiter.consume("127.0.0.1:read", "read").allowed).toBe(true);
    expect(limiter.consume("127.0.0.1:read", "read")).toEqual({ allowed: false, retryAfterSeconds: 10 });
    expect(limiter.consume("127.0.0.1:write", "write").allowed).toBe(true);
    expect(limiter.consume("other:read", "read").allowed).toBe(true);
    now = 11_000;
    expect(limiter.consume("127.0.0.1:read", "read").allowed).toBe(true);
  });

  it("bounds its per-client key map and fails closed when full", () => {
    let now = 0;
    const limiter = createRequestLimiter({ windowMs: 10_000, limits: { read: 1 }, maxEntries: 1, now: () => now });
    expect(limiter.consume("client-1", "read").allowed).toBe(true);
    expect(limiter.consume("client-2", "read")).toEqual({ allowed: false, retryAfterSeconds: 10 });
    expect(limiter.activeKeys).toBe(1);
    now = 10_000;
    expect(limiter.consume("client-2", "read").allowed).toBe(true);
    expect(limiter.activeKeys).toBe(1);
  });

  it("rejects an unconfigured or malformed bucket", () => {
    const limiter = createRequestLimiter({ limits: { read: 1 } });
    expect(() => limiter.consume("client", "write")).toThrow(/limit/i);
    expect(() => limiter.consume("", "read")).toThrow(/key/i);
  });
});
