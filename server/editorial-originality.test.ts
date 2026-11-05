import { describe, expect, it } from "vitest";
import { analyzeOriginality } from "./editorial-originality.mjs";

const candidate = "Responsible AI adoption helps small businesses improve customer service while protecting private data and requiring human review.";

function stateWithDraft(text, workspaceId = "workspace-1") {
  return {
    editorialDrafts: [],
    platformVariants: [],
    originalityChecks: [],
    conversationDrafts: [{
      id: "saved-draft-1",
      workspaceId,
      conversationId: "conversation-1",
      title: "Saved editorial content",
      body: text,
      clientId: "client-1",
      brandId: "brand-1"
    }],
    tasks: {}
  };
}

describe("analyzeOriginality", () => {
  it("flags an exact match and requires human review", () => {
    const report = analyzeOriginality(stateWithDraft(candidate), "workspace-1", candidate, {
      clientId: "client-1",
      brandId: "brand-1"
    });

    expect(report.status).toBe("exact-match-review");
    expect(report.reviewRequired).toBe(true);
    expect(report.findings[0]).toMatchObject({ matchType: "exact", similarity: 1 });
    expect(report.comparedContentCount).toBe(1);
    expect(report.limitations.join(" ")).toContain("not a plagiarism verdict");
  });

  it("detects substantial lexical overlap without calling it plagiarism", () => {
    const saved = "Responsible AI adoption helps small businesses improve customer service while protecting private data and requiring careful human review.";
    const report = analyzeOriginality(stateWithDraft(saved), "workspace-1", candidate, {
      clientId: "client-1",
      brandId: "brand-1",
      reviewThreshold: 0.35
    });

    expect(report.reviewRequired).toBe(true);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(["strong-overlap-review", "possible-overlap-review"]).toContain(report.status);
    expect(report.signal.interpretation).toContain("human");
  });

  it("does not leak matches across workspaces", () => {
    const report = analyzeOriginality(stateWithDraft(candidate, "workspace-other"), "workspace-1", candidate, {
      clientId: "client-1",
      brandId: "brand-1"
    });

    expect(report.comparedContentCount).toBe(0);
    expect(report.status).toBe("no-internal-match-found");
    expect(report.reviewRequired).toBe(false);
  });

  it("does not claim originality when the candidate is too short", () => {
    const report = analyzeOriginality(stateWithDraft("tiny phrase"), "workspace-1", "tiny phrase", {
      clientId: "client-1",
      brandId: "brand-1"
    });

    expect(report.status).toBe("insufficient-text");
    expect(report.reviewRequired).toBe(true);
    expect(report.signal.interpretation).toContain("too short");
  });

  it("rejects invalid scope and input", () => {
    expect(() => analyzeOriginality({}, "", candidate)).toThrow("workspaceId is required");
    expect(() => analyzeOriginality({}, "workspace-1", null)).toThrow("candidateText must be a string");
  });
});
