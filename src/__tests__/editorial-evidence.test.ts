import { describe, expect, it } from "vitest";
import { checkOriginality, listClaims, normalizeEditorialText, registerClaim } from "../../server/editorial-evidence.mjs";

function stateFixture() {
  return {
    tasks: {
      task-a: { workspaceId: "workspace-a", article: { topic: "First" } },
      task-b: { workspaceId: "workspace-a", article: { topic: "Second" } },
      task-other: { workspaceId: "workspace-b", article: { topic: "Other" } }
    },
    sources: [
      { id: "source-a", workspaceId: "workspace-a", taskId: "task-a", url: "https://example.com/a" },
      { id: "source-b", workspaceId: "workspace-a", taskId: "task-b", url: "https://example.com/b" }
    ],
    claims: [],
    originalityChecks: []
  };
}

describe("editorial evidence", () => {
  it("normalizes common Arabic orthographic variants and punctuation", () => {
    expect(normalizeEditorialText("إِنَّ النَّتَائِجَ، مُهِمَّةٌ!")).toBe("ان النتائج مهمه");
  });

  it("links claims only to sources from the same workspace and task", () => {
    const state = stateFixture();
    const claim = registerClaim(state, {
      workspaceId: "workspace-a",
      taskId: "task-a",
      text: "The company reported annual revenue growth.",
      sourceIds: ["source-a"]
    });
    expect(claim.evidenceState).toBe("source-linked-unverified");
    expect(listClaims(state, "workspace-a", "task-a").summary).toMatchObject({
      total: 1, sourceLinked: 1, unlinked: 0, coveragePercent: 100
    });
    expect(() => registerClaim(state, {
      workspaceId: "workspace-a",
      taskId: "task-a",
      text: "This claim attempts to cite another article source.",
      sourceIds: ["source-b"]
    })).toThrow("Every linked source must belong to this workspace and article");
  });

  it("rejects cross-workspace task access", () => {
    expect(() => listClaims(stateFixture(), "workspace-a", "task-other")).toThrow("Editorial task not found");
  });

  it("detects normalized exact matches in other tasks in the same workspace", () => {
    const state = stateFixture();
    const text = "The organization announced a major expansion across several regional markets this year.";
    checkOriginality(state, { workspaceId: "workspace-a", taskId: "task-a", text });
    const result = checkOriginality(state, {
      workspaceId: "workspace-a",
      taskId: "task-b",
      text: "THE ORGANIZATION ANNOUNCED A MAJOR EXPANSION ACROSS SEVERAL REGIONAL MARKETS THIS YEAR!"
    });
    expect(result.outcome).toBe("exact-match");
    expect(result.exactMatchTaskId).toBe("task-a");
  });

  it("does not compare content across workspaces", () => {
    const state = stateFixture();
    const text = "A sufficiently long editorial text is used here to verify workspace isolation behavior.";
    checkOriginality(state, { workspaceId: "workspace-a", taskId: "task-a", text });
    const result = checkOriginality(state, {
      workspaceId: "workspace-b",
      taskId: "task-other",
      text
    });
    expect(result.outcome).toBe("no-match-found");
  });
});
