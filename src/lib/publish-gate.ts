import type { AdapterCapability } from "../data/adapter-registry";

export interface PublishGateInput {
  adapter: AdapterCapability;
  credentialsValidated: boolean;
  policyReviewed: boolean;
  targetAccountValidated: boolean;
  humanApprovalGranted: boolean;
  idempotencyKeyPresent: boolean;
}

export interface PublishGateResult {
  allowed: boolean;
  blockers: string[];
}

/**
 * Fail-closed publishing gate. Registry metadata alone can never authorize a
 * publication. A real adapter must be implemented and verified first.
 */
export function evaluatePublishGate(input: PublishGateInput): PublishGateResult {
  const blockers: string[] = [];
  const { adapter } = input;

  if (adapter.implementationStatus !== "verified") blockers.push("adapter-not-verified");
  if (adapter.role === "research-repository" || adapter.role === "data-source" || adapter.role === "knowledge-base") {
    blockers.push("not-a-general-editorial-destination");
  }
  if (adapter.integration === "research-only" || adapter.integration === "manual") {
    blockers.push("automated-publishing-not-supported");
  }
  if (!input.credentialsValidated) blockers.push("credentials-not-validated");
  if (!input.policyReviewed) blockers.push("platform-policy-not-reviewed");
  if (!input.targetAccountValidated) blockers.push("target-account-not-validated");
  if (adapter.humanApproval === "required" && !input.humanApprovalGranted) blockers.push("human-approval-required");
  if (!input.idempotencyKeyPresent) blockers.push("idempotency-key-missing");

  return { allowed: blockers.length === 0, blockers };
}
