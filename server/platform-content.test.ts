import { describe, expect, it, vi } from "vitest";
import { generatePlatformVariant, listPlatformVariants } from "./platform-content.mjs";

function makeState() {
  return {
    tasks: {
      "task-a": { workspaceId: "workspace-a", article: { topic: "Solar energy", language: "en", objective: "analysis" } }
    },
    editorialDrafts: [{
      id: "draft-a", workspaceId: "workspace-a", taskId: "task-a", updatedAt: "2026-11-04T00:00:00.000Z",
      title: "Solar energy in cities", dek: "An evidence-led overview", editorialAngle: "Practical urban adoption",
      sections: [{ heading: "The opportunity", body: "Cities are evaluating solar installations using local planning and energy data." }]
    }],
    platformVariants: [],
    mediaAssets: [] as { id: string; workspaceId: string; taskId: string; kind: string; mimeType: string; description: string; storageKey: string }[]
  };
}
function makeStore(state = makeState()) {
  return {
    state,
    read: vi.fn(async () => structuredClone(state)),
    transact: vi.fn(async fn => fn(state))
  };
}
function validOutput(platformId = "linkedin") {
  return {
    platformId, language: "en", format: "feed-post", title: "", hook: "A practical question for city leaders",
    body: "Cities can assess solar projects through local energy data and a transparent planning process.",
    callToAction: "What data would help your community decide?", hashtags: ["solar", "cities"], selectedMediaIds: [],
    videoScript: "", onScreenText: "", shotPlan: "", mediaBrief: "Use a simple diagram of the assessment steps.",
    accessibilityNotes: "Use readable contrast and alt text for any chart."
  };
}

describe("platform-native editorial adaptation", () => {
  it("generates and stores a draft-only platform variant without publishing", async () => {
    const store = makeStore();
    const provider = { id: "test-provider", model: "mock", generateJSON: vi.fn(async () => ({ output: validOutput(), usage: { totalTokens: 42 } })) };
    const result = await generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin", placement: "feed" });
    expect(provider.generateJSON).toHaveBeenCalledOnce();
    expect(result.externalAction).toBe("none");
    expect(result.variant).toMatchObject({ platformName: "LinkedIn", status: "draft-only", reviewRequired: true, placement: "feed" });
    expect(listPlatformVariants(store.state, "workspace-a", "task-a")).toHaveLength(1);
  });

  it("rejects an exact repeat already saved in the same workspace", async () => {
    const store = makeStore();
    const provider = { generateJSON: vi.fn()
      .mockResolvedValueOnce({ output: validOutput("linkedin") })
      .mockResolvedValueOnce({ output: validOutput("instagram") }) };
    await generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" });
    await expect(generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "instagram" })).rejects.toMatchObject({ status: 409 });
    expect(store.state.platformVariants).toHaveLength(1);
  });

  it("checks a social draft against other article drafts but not its own source article", async () => {
    const output = validOutput();
    const candidateText = [output.title, output.hook, output.body, output.callToAction, ...output.hashtags].filter(Boolean).join(" ");
    const state = makeState();
    state.editorialDrafts[0].sections[0].body = candidateText;
    const ownSourceStore = makeStore(state);
    const provider = { generateJSON: vi.fn(async () => ({ output })) };
    await expect(generatePlatformVariant({ provider, store: ownSourceStore, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" })).resolves.toMatchObject({ externalAction: "none" });

    const otherArticleState = makeState();
    otherArticleState.tasks["task-b"] = { workspaceId: "workspace-a", article: { topic: "", language: "en", objective: "analysis" } };
    otherArticleState.editorialDrafts.push({ id: "draft-b", workspaceId: "workspace-a", taskId: "task-b", title: "", dek: "", editorialAngle: "", metaTitle: "", metaDescription: "", sections: [{ heading: "", body: candidateText }] });
    const otherArticleStore = makeStore(otherArticleState);
    await expect(generatePlatformVariant({ provider, store: otherArticleStore, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" }))
      .rejects.toThrow("with another article");
  });

  it("applies client boundaries to social duplicate checks and reports sibling-brand matches", async () => {
    const output = validOutput();
    const candidateText = [output.title, output.hook, output.body, output.callToAction, ...output.hashtags].filter(Boolean).join(" ");
    const makeOtherClientState = () => {
      const state = makeState();
      state.tasks["task-a"].article.clientId = "client-a";
      state.tasks["task-a"].article.brandId = "brand-a";
      state.tasks["task-b"] = { workspaceId: "workspace-a", article: { topic: "", language: "en", objective: "analysis", clientId: "client-b", brandId: "brand-b" } };
      state.editorialDrafts.push({ id: "draft-b", workspaceId: "workspace-a", taskId: "task-b", title: "", sections: [{ heading: "", body: candidateText }] });
      return state;
    };
    const provider = { generateJSON: vi.fn(async () => ({ output })) };
    await expect(generatePlatformVariant({ provider, store: makeStore(makeOtherClientState()), workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" }))
      .resolves.toMatchObject({ externalAction: "none" });

    const siblingBrandState = makeOtherClientState();
    siblingBrandState.tasks["task-b"].article.clientId = "client-a";
    siblingBrandState.tasks["task-b"].article.brandId = "brand-sibling";
    await expect(generatePlatformVariant({ provider, store: makeStore(siblingBrandState), workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" }))
      .rejects.toThrow("for another brand of the same client");
  });

  it("passes only user descriptions for selected media and validates returned media IDs", async () => {
    const state = makeState();
    state.mediaAssets = [{ id: "media-1", workspaceId: "workspace-a", taskId: "task-a", kind: "image", mimeType: "image/png", description: "Solar panels on a school roof", storageKey: "private-file.png" }];
    const store = makeStore(state);
    const provider = { generateJSON: vi.fn(async ({ prompt }: { prompt: string }) => {
      expect(prompt).toContain("Solar panels on a school roof");
      expect(prompt).not.toContain("private-file.png");
      return { output: { ...validOutput(), selectedMediaIds: ["media-1"] } };
    }) };
    const result = await generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin", mediaAssetIds: ["media-1"] });
    expect(result.variant.selectedMediaIds).toEqual(["media-1"]);
    await expect(generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin", mediaAssetIds: ["other-workspace-asset"] })).rejects.toMatchObject({ status: 404 });
  });

  it("uses the saved GEO brief as natural editorial guidance for social variants", async () => {
    const state = makeState();
    state.editorialDrafts[0].geoBrief = {
      intent: "informational", primaryQuery: "urban solar planning", supportingTerms: ["city rooftop assessment"],
      targetQuestions: [{ question: "How can cities assess rooftops?" }], targetEntityIds: ["entity-1"]
    };
    state.entities = [{ id: "entity-1", workspaceId: "workspace-a", taskId: "task-a", canonicalName: "City Energy Office", aliases: ["CEO"], disambiguationNote: "Local municipal office." }];
    const store = makeStore(state);
    const provider = { generateJSON: vi.fn(async ({ system, prompt }: { system: string; prompt: string }) => {
      expect(prompt).toContain("urban solar planning");
      expect(prompt).toContain("How can cities assess rooftops?");
      expect(prompt).toContain("City Energy Office");
      expect(system).toContain("Do not stuff phrases");
      return { output: validOutput() };
    }) };
    await generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" });
  });

  it("rejects a model response for the wrong platform or language", async () => {
    const store = makeStore();
    const wrongPlatform = { generateJSON: async () => ({ output: validOutput("instagram") }) };
    await expect(generatePlatformVariant({ provider: wrongPlatform, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" })).rejects.toMatchObject({ status: 422 });
    const wrongLanguage = { generateJSON: async () => ({ output: { ...validOutput(), language: "ar" } }) };
    await expect(generatePlatformVariant({ provider: wrongLanguage, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" })).rejects.toMatchObject({ status: 422 });
  });

  it("rejects unsupported platforms and other workspaces", async () => {
    const store = makeStore();
    const provider = { generateJSON: async () => ({ output: validOutput() }) };
    await expect(generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "wikipedia" })).rejects.toMatchObject({ status: 400 });
    await expect(generatePlatformVariant({ provider, store, workspaceId: "workspace-b", taskId: "task-a", platformId: "linkedin" })).rejects.toMatchObject({ status: 404 });
  });

  it("does not store a generated result if the source draft changed during generation", async () => {
    const store = makeStore();
    const provider = { generateJSON: vi.fn(async () => {
      store.state.editorialDrafts[0].updatedAt = "2026-11-04T00:01:00.000Z";
      return { output: validOutput() };
    }) };
    await expect(generatePlatformVariant({ provider, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" })).rejects.toMatchObject({ status: 409 });
    expect(store.state.platformVariants).toHaveLength(0);
  });

  it("requires a configured provider and a non-empty article draft", async () => {
    const store = makeStore();
    await expect(generatePlatformVariant({ provider: null, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" })).rejects.toMatchObject({ status: 503 });
    store.state.editorialDrafts[0].sections[0].body = "";
    await expect(generatePlatformVariant({ provider: { generateJSON: async () => ({ output: validOutput() }) }, store, workspaceId: "workspace-a", taskId: "task-a", platformId: "linkedin" })).rejects.toMatchObject({ status: 409 });
  });
});
