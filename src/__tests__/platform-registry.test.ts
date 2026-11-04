import { describe, expect, it } from "vitest";
import { adapterRegistry } from "../data/adapter-registry";
import { platforms } from "../data/platforms";
import { evaluatePublishGate } from "../lib/publish-gate";

describe("platform registry integrity", () => {
  it("has one adapter profile for every imported platform", () => {
    expect(Object.keys(adapterRegistry).sort()).toEqual(platforms.map(p => p.id).sort());
  });

  it("keeps verification checklists non-empty", () => {
    for (const adapter of Object.values(adapterRegistry)) {
      expect(adapter.verificationChecklist.length).toBeGreaterThan(0);
    }
  });

  it("does not mark any platform as verified during foundation setup", () => {
    for (const adapter of Object.values(adapterRegistry)) {
      expect(adapter.implementationStatus).not.toBe("verified");
    }
  });
});

describe("fail-closed publish gate", () => {
  it("blocks every current registry adapter because none is verified", () => {
    for (const adapter of Object.values(adapterRegistry)) {
      const result = evaluatePublishGate({
        adapter,
        credentialsValidated: true,
        policyReviewed: true,
        targetAccountValidated: true,
        humanApprovalGranted: true,
        idempotencyKeyPresent: true
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain("adapter-not-verified");
    }
  });

  it("blocks publishing without an idempotency key", () => {
    const adapter = adapterRegistry.wordpress;
    const result = evaluatePublishGate({
      adapter,
      credentialsValidated: true,
      policyReviewed: true,
      targetAccountValidated: true,
      humanApprovalGranted: true,
      idempotencyKeyPresent: false
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("idempotency-key-missing");
  });
});
