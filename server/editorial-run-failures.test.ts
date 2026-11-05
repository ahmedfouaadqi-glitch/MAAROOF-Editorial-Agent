import { describe, expect, it } from "vitest";
import { classifyEditorialRunFailure } from "./editorial-run-failures.mjs";

describe("classifyEditorialRunFailure", () => {
  it("marks transient provider and network failures as retryable", () => {
    expect(classifyEditorialRunFailure(Object.assign(new Error("busy"), { status: 429 }))).toMatchObject({ code: "http-429", category: "rate-limit", retryable: true });
    expect(classifyEditorialRunFailure(Object.assign(new Error("timeout"), { status: 503 }))).toMatchObject({ code: "http-503", category: "provider-or-server", retryable: true });
    expect(classifyEditorialRunFailure(Object.assign(new Error("reset"), { code: "ECONNRESET" }))).toMatchObject({ code: "transient-network-error", category: "network", retryable: true });
  });

  it("does not mark invalid requests or malformed provider output as retryable", () => {
    expect(classifyEditorialRunFailure(Object.assign(new Error("bad request"), { status: 400 }))).toMatchObject({ code: "http-400", category: "request", retryable: false });
    expect(classifyEditorialRunFailure(new SyntaxError("invalid JSON"))).toMatchObject({ code: "invalid-provider-response", retryable: false });
    expect(classifyEditorialRunFailure(new Error("unexpected"))).toMatchObject({ code: "editorial-run-failed", category: "unknown", retryable: false });
  });

  it("never includes raw provider error messages in the classification", () => {
    const result = classifyEditorialRunFailure(new Error("secret token and private endpoint"));
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private endpoint");
  });
});
