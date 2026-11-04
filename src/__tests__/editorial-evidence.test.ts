import { describe, expect, it } from "vitest";
import { checkOriginality, listClaims, normalizeEditorialText, registerClaim } from "../../server/editorial-evidence.mjs";

function stateFixture() {
  return {
    tasks: {
      "task-a": { workspaceId: "workspace-a", article: { topic: "First" } },
      "task-b": { workspaceId: "workspace-a", article: { topic: "Second" } },
      "task-other": { workspaceId: "workspace-b", article: { topic: "Other" } }
    },
    sources: [
      { id: "source-a", workspaceId: "workspace-a", taskId: "task-a", url: "https://example.com/a" },
      { id: "source-b", workspaceId: "workspace-a", taskId: "task-b", url: "https://example.com/b" }
    ],
    claims: [],
    originalityChecks: [],
    editorialDrafts: [] as any[],
    platformVariants: [] as any[]
  };
}

describe("editorial evidence", () => {
  it("normalizes common Arabic orthographic variants and punctuation", () => {
    expect(normalizeEditorialText("إِنَّ النَّتَائِجَ، مُهِمَّةٌ!")).toBe("ان النتايج مهمة");
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

  it("flags high token-overlap text as a possible near duplicate", () => {
    const state = stateFixture();
    checkOriginality(state, {
      workspaceId: "workspace-a",
      taskId: "task-a",
      text: "The company announced a major expansion across several regional markets during the current financial year."
    });
    const result = checkOriginality(state, {
      workspaceId: "workspace-a",
      taskId: "task-b",
      text: "The company announced a major expansion across several regional markets during the current fiscal year."
    });
    expect(result.outcome).toBe("possible-near-duplicate");
    expect(result.nearMatches[0].taskId).toBe("task-a");
    expect(result.nearMatches[0].similarity).toBeGreaterThanOrEqual(0.82);
  });

  it("compares against saved article drafts and reports the matched content type", () => {
    const state = stateFixture();
    const text = "A detailed editorial article explains the organization's regional expansion, its market context, and the strategy for responsible growth over the coming year.";
    state.tasks["task-a"].article.topic = "";
    state.editorialDrafts.push({ id: "draft-a", workspaceId: "workspace-a", taskId: "task-a", sections: [{ heading: "", body: text }] });
    const result = checkOriginality(state, { workspaceId: "workspace-a", taskId: "task-b", text });
    expect(result.outcome).toBe("exact-match");
    expect(result.exactMatchContentType).toBe("article-draft");
    expect(result.exactMatches[0].recordId).toBe("draft-a");
    expect(result.comparedByType["article-draft"]).toBe(1);
  });

  it("compares against saved social drafts and reports their platform", () => {
    const state = stateFixture();
    const text = "The organization announces regional expansion with a careful plan for its local communities and future market development.";
    state.platformVariants.push({ id: "social-a", workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin", body: text, hashtags: [] });
    const result = checkOriginality(state, { workspaceId: "workspace-a", taskId: "task-b", text });
    expect(result.outcome).toBe("exact-match");
    expect(result.exactMatches[0]).toMatchObject({ recordId: "social-a", contentType: "social-draft", platformId: "linkedin" });
  });

  it("compares within the same client across its brands but excludes another client", () => {
    const state: any = stateFixture();
    const text = "The same substantive article content is deliberately reused to test client scoped duplicate comparison across brands.";
    state.tasks["task-a"].article = { topic: "", clientId: "client-a", brandId: "brand-sibling" };
    state.tasks["task-b"].article = { topic: "", clientId: "client-a", brandId: "brand-current" };
    state.tasks["task-c"] = { workspaceId: "workspace-a", article: { topic: "", clientId: "client-b", brandId: "brand-other" } };
    state.editorialDrafts.push(
      { id: "draft-sibling", workspaceId: "workspace-a", taskId: "task-a", sections: [{ heading: "", body: text }] },
      { id: "draft-other-client", workspaceId: "workspace-a", taskId: "task-c", sections: [{ heading: "", body: text }] }
    );
    const result = checkOriginality(state, { workspaceId: "workspace-a", taskId: "task-b", text });
    expect(result.outcome).toBe("exact-match");
    expect(result.comparisonScope).toBe("same-client-plus-unassigned");
    expect(result.exactMatches).toHaveLength(1);
    expect(result.exactMatches[0]).toMatchObject({ taskId: "task-a", identityRelationship: "same-client-other-brand", brandId: "brand-sibling" });
  });

  it("excludes the current article and its own social variants from self-comparison", () => {
    const state = stateFixture();
    const text = "A detailed editorial article explains the organization's regional expansion, its market context, and the strategy for responsible growth over the coming year.";
    state.editorialDrafts.push({ id: "draft-a", workspaceId: "workspace-a", taskId: "task-a", title: "Regional expansion strategy", sections: [{ heading: "Market context", body: text }] });
    state.platformVariants.push({ id: "social-a", workspaceId: "workspace-a", taskId: "task-a", body: text });
    const result = checkOriginality(state, { workspaceId: "workspace-a", taskId: "task-a", text });
    expect(result.outcome).toBe("no-match-found");
    expect(result.comparedContentCount).toBe(0);
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
