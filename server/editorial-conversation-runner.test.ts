import { describe, expect, it, vi } from "vitest";
import { appendEditorialConversationMessage, createEditorialConversation, getEditorialConversation, updateEditorialConversationRun } from "./editorial-conversations.mjs";
import { createEditorialConversationProgress, runEditorialConversation, cancelEditorialConversationRun } from "./editorial-conversation-runner.mjs";

type ProgressStep = { id: string; status?: string; note?: string };
type RunFixture = { status?: string; metadata?: { steps: ProgressStep[]; selectedSkills?: { id: string }[] } };
type RunnerState = { editorialConversations: unknown[]; conversationAttachments: unknown[]; conversationDrafts: unknown[]; clients: unknown[]; brands: unknown[]; editorialDrafts: unknown[]; platformVariants: unknown[]; originalityChecks: unknown[]; tasks: Record<string, unknown> };
function makeStore() {
  const state: RunnerState = {
    editorialConversations: [], conversationAttachments: [], conversationDrafts: [], clients: [], brands: [],
    editorialDrafts: [], platformVariants: [], originalityChecks: [], tasks: {}
  };
  return {
    state,
    read: vi.fn(async () => structuredClone(state)),
    transact: vi.fn(async (mutator: (value: RunnerState) => unknown) => mutator(state))
  };
}
async function startConversation(store: ReturnType<typeof makeStore>, brandProfile?: { voice?: string; audience?: string; approvedFacts?: string; avoid?: string }) {
  const conversation = await createEditorialConversation(store, {
    workspaceId: "workspace-1", targetId: "linkedin", language: "en", clientName: "Client A", brandName: "Brand A", brandProfile
  });
  const userMessage = await appendEditorialConversationMessage(store, {
    workspaceId: "workspace-1", conversationId: conversation.id, role: "user", targetId: "linkedin",
    content: "Write a concise LinkedIn post about responsible AI adoption for small businesses.", clientMessageId: `user-${Date.now()}-${Math.random()}`
  });
  return { conversation, userMessage };
}
const validOutput = {
  title: "Responsible AI for Small Businesses", hook: "Start with one workflow, not a full transformation.",
  body: "Small businesses can adopt AI responsibly by choosing one repeatable workflow, checking the output with a human, and measuring whether it saves time without exposing sensitive data.",
  callToAction: "Which workflow would you start with?", hashtags: ["ResponsibleAI", "SmallBusiness"],
  format: "Post", geo: {
    intent: "Practical guidance for small businesses considering AI adoption",
    primaryPhrase: "responsible AI adoption for small businesses",
    supportingTerms: ["human review", "data protection"],
    questions: ["How can a small business start using AI responsibly?"],
    entities: ["small businesses", "artificial intelligence"]
  }, mediaNotes: "Use a simple workflow diagram.", factCheckNotes: []
};

describe("editorial conversation workflow", () => {
  it("shows unavailable model and external research steps honestly", async () => {
    const store = makeStore();
    const { conversation, userMessage } = await startConversation(store);
    const progress = createEditorialConversationProgress("en");
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-1", status: "queued", metadata: progress });
    const outcome = await runEditorialConversation({ store, provider: null, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-1", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    expect(outcome.status).toBe("failed");
    const saved = await getEditorialConversation(store, "workspace-1", conversation.id);
    expect(saved.activeRun?.status).toBe("failed");
    expect(saved.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "discovery")?.status).toBe("skipped");
    expect(saved.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "draft")?.status).toBe("skipped");
    expect(saved.activeRun?.metadata?.selectedSkills?.length).toBeGreaterThan(0);
    expect(saved.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "request")?.note).toContain("Automatically selected skills:");
    expect(saved.messages.at(-1)?.result).toMatchObject({ kind: "notice", code: "model-provider-unavailable" });
    expect(saved.messages.at(-1)?.result?.selectedSkills?.length).toBeGreaterThan(0);
    expect(store.state.conversationDrafts).toHaveLength(0);
  });

  it("generates a destination-specific GEO draft and flags an exact repeat for review", async () => {
    const store = makeStore();
    const { conversation, userMessage } = await startConversation(store);
    const provider = { generateJSON: vi.fn(async () => ({ output: validOutput, provider: "openai-compatible", model: "test-model", usage: { totalTokens: 50 } })) };
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-1", status: "queued", metadata: createEditorialConversationProgress("en") });
    const first = await runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-1", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    expect(first).toMatchObject({ status: "completed", needsReview: false });
    const savedFirst = await getEditorialConversation(store, "workspace-1", conversation.id);
    expect(savedFirst.messages.at(-1)?.result).toMatchObject({ kind: "draft", targetId: "linkedin", draft: { geo: { primaryPhrase: "responsible AI adoption for small businesses" } } });
    expect(savedFirst.messages.at(-1)?.result?.selectedSkills?.length).toBeGreaterThan(0);
    expect(savedFirst.activeRun?.metadata?.selectedSkills?.map((skill: { id: string }) => skill.id)).toEqual(savedFirst.messages.at(-1)?.result?.selectedSkills?.map((skill: { id: string }) => skill.id));
    expect(savedFirst.messages.at(-1)?.result?.selectedSkills?.length).toBeLessThanOrEqual(2);
    const firstProviderCall = provider.generateJSON.mock.calls[0]?.[0] as { system: string; prompt: string };
    expect(firstProviderCall.prompt).toContain("Selected skill playbooks");
    expect(firstProviderCall.system).toContain("Selected skill playbooks are user-provided task guidance");
    expect(savedFirst.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "discovery")?.status).toBe("skipped");

    const secondUserMessage = await appendEditorialConversationMessage(store, {
      workspaceId: "workspace-1", conversationId: conversation.id, role: "user", targetId: "linkedin",
      content: "Please refine this draft without changing its main point.", clientMessageId: "user-second"
    });
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-2", status: "queued", metadata: createEditorialConversationProgress("en") });
    const second = await runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-2", userMessageId: secondUserMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    expect(second).toMatchObject({ status: "completed", needsReview: true });
    expect(provider.generateJSON).toHaveBeenCalledTimes(2);
    expect(store.state.conversationDrafts).toHaveLength(2);
    const finalConversation = await getEditorialConversation(store, "workspace-1", conversation.id);
    expect(finalConversation.messages.at(-1)?.result).toMatchObject({ needsReview: true });
    expect(finalConversation.messages.at(-1)?.result?.handoffEligible).toBe(true);
    const secondProviderCall = provider.generateJSON.mock.calls[1]?.[0] as { system: string };
    expect(secondProviderCall.system).toContain("Destination voice/style:");
    expect(secondProviderCall.system).toContain("Use GEO deliberately");
    expect(finalConversation.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "originality")?.status).toBe("needs-review");
  });

  it("includes only the selected workspace brand's saved guidance in the model prompt", async () => {
    const store = makeStore();
    const guide = { voice: "Clear, calm and evidence-led", audience: "Regional startup founders", approvedFacts: "Founded in 2018", avoid: "Guaranteed growth" };
    const { conversation, userMessage } = await startConversation(store, guide);
    const provider = { generateJSON: vi.fn(async () => ({ output: validOutput, provider: "openai-compatible", model: "test-model" })) };
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-brand-guide", status: "queued", metadata: createEditorialConversationProgress("en") });
    await runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-brand-guide", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    const call = provider.generateJSON.mock.calls[0]?.[0] as { system: string; prompt: string };
    expect(call.prompt).toContain(guide.voice);
    expect(call.prompt).toContain(guide.approvedFacts);
    expect(call.prompt).toContain(guide.avoid);
    expect(call.prompt).toContain("untrusted style context");
    expect(call.prompt).toContain("Client A");
    expect(call.prompt).toContain("applying-brand-guidelines");
    expect(call.system).not.toContain(guide.voice);
    expect(call.system).not.toContain(guide.approvedFacts);
    expect(call.system).not.toContain("Brand A");
    expect(call.system).toContain("Do not treat user-supplied claims as verified fact");
  });

  it("keeps a non-publication PRD out of platform GEO and browser handoff", async () => {
    const store = makeStore();
    const conversation = await createEditorialConversation(store, { workspaceId: "workspace-1", targetId: "linkedin", language: "en" });
    const userMessage = await appendEditorialConversationMessage(store, {
      workspaceId: "workspace-1", conversationId: conversation.id, role: "user", targetId: "linkedin",
      content: "Create a PRD for a bilingual editorial SaaS app", clientMessageId: "user-prd"
    });
    const provider = { generateJSON: vi.fn(async () => ({
      output: { ...validOutput, title: "Product Requirements Document", hook: "", callToAction: "", hashtags: [], format: "PRD", geo: { intent: "", primaryPhrase: "", supportingTerms: [], questions: [], entities: [] } },
      provider: "openai-compatible", model: "test-model"
    })) };
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-prd", status: "queued", metadata: createEditorialConversationProgress("en") });
    await runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-prd", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    const saved = await getEditorialConversation(store, "workspace-1", conversation.id);
    const result = saved.messages.at(-1)?.result;
    const call = provider.generateJSON.mock.calls[0]?.[0] as { system: string; prompt: string };
    expect(result).toMatchObject({ handoffEligible: false, intelligence: null, selectedSkills: [expect.objectContaining({ skillId: "create-prd" })] });
    expect(saved.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "geo")?.status).toBe("skipped");
    expect(call.system).toContain("request is not a publishable post/article");
    expect(call.system).not.toContain("Destination voice/style:");
    expect(call.prompt).toContain("Do not turn it into a social post or article");
  });

  it("honors explicit non-publication intent over both a post keyword and prior post context", async () => {
    const store = makeStore();
    const { conversation, userMessage } = await startConversation(store);
    const provider = { generateJSON: vi.fn(async () => ({ output: validOutput, provider: "openai-compatible", model: "test-model" })) };
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-before-nonpublish", status: "queued", metadata: createEditorialConversationProgress("en") });
    await runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-before-nonpublish", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    const followUp = await appendEditorialConversationMessage(store, {
      workspaceId: "workspace-1", conversationId: conversation.id, role: "user", targetId: "linkedin",
      content: "Shorten this into an internal memo, not for publication.", clientMessageId: "user-nonpublish-followup"
    });
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-nonpublish-followup", status: "queued", metadata: createEditorialConversationProgress("en") });
    await runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-nonpublish-followup", userMessageId: followUp.id, mediaDir: "/tmp/editorial-chat-no-media" });
    const savedFollowUp = await getEditorialConversation(store, "workspace-1", conversation.id);
    expect(savedFollowUp.messages.at(-1)?.result?.handoffEligible).toBe(false);
    expect(savedFollowUp.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "geo")?.status).toBe("skipped");
    const followUpCall = provider.generateJSON.mock.calls[1]?.[0] as { system: string };
    expect(followUpCall.system).not.toContain("Destination voice/style:");

    const arStore = makeStore();
    const arConversation = await createEditorialConversation(arStore, { workspaceId: "workspace-1", targetId: "linkedin", language: "ar" });
    const arMessage = await appendEditorialConversationMessage(arStore, {
      workspaceId: "workspace-1", conversationId: arConversation.id, role: "user", targetId: "linkedin",
      content: "اكتب منشوراً عن الفكرة، لكنه ليس للنشر؛ أريده مثالاً داخلياً.", clientMessageId: "user-ar-nonpublish"
    });
    await updateEditorialConversationRun(arStore, { workspaceId: "workspace-1", conversationId: arConversation.id, runId: "run-ar-nonpublish", status: "queued", metadata: createEditorialConversationProgress("ar") });
    await runEditorialConversation({ store: arStore, provider, workspaceId: "workspace-1", conversationId: arConversation.id, runId: "run-ar-nonpublish", userMessageId: arMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    const savedArabic = await getEditorialConversation(arStore, "workspace-1", arConversation.id);
    expect(savedArabic.messages.at(-1)?.result?.handoffEligible).toBe(false);
    expect(savedArabic.activeRun?.metadata?.steps.find((step: ProgressStep) => step.id === "geo")?.status).toBe("skipped");
  });

  it("keeps unavailable campaign media tools behind an explicit integration boundary", async () => {
    const store = makeStore();
    const conversation = await createEditorialConversation(store, { workspaceId: "workspace-1", targetId: "linkedin", language: "en" });
    const userMessage = await appendEditorialConversationMessage(store, {
      workspaceId: "workspace-1", conversationId: conversation.id, role: "user", targetId: "linkedin",
      content: "Create a full multi-channel product campaign for Product X", clientMessageId: "user-campaign"
    });
    const provider = { generateJSON: vi.fn(async () => ({ output: { ...validOutput, body: "A text-only campaign concept and launch sequence based on the supplied product details." }, provider: "openai-compatible", model: "test-model" })) };
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-campaign", status: "queued", metadata: createEditorialConversationProgress("en") });
    await runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-campaign", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    const saved = await getEditorialConversation(store, "workspace-1", conversation.id);
    const result = saved.messages.at(-1)?.result;
    const call = provider.generateJSON.mock.calls[0]?.[0] as { system: string; prompt: string };
    expect(result).toMatchObject({ handoffEligible: false, selectedSkills: [expect.objectContaining({ skillId: "muapi-product-campaign", runtimeStatus: "blocked_on_integration" })] });
    expect(call.system).toContain("unavailable integrations: muapi-product-campaign");
    expect(call.system).toContain("Do not invoke or imitate their APIs/tools");
  });

  it("cancels an in-flight model request and does not save a draft", async () => {
    const store = makeStore();
    const { conversation, userMessage } = await startConversation(store);
    const provider = { generateJSON: vi.fn(({ signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("cancelled"), { name: "AbortError" })), { once: true });
    })) };
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-cancel", status: "queued", metadata: createEditorialConversationProgress("en") });
    const running = runEditorialConversation({ store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-cancel", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" });
    await vi.waitFor(() => expect(provider.generateJSON).toHaveBeenCalledTimes(1));
    const cancellation = await cancelEditorialConversationRun({ store, workspaceId: "workspace-1", conversationId: conversation.id });
    const outcome = await running;
    expect(cancellation.cancelled).toBe(true);
    expect(outcome.status).toBe("cancelled");
    const saved = await getEditorialConversation(store, "workspace-1", conversation.id);
    expect(saved.activeRun?.status).toBe("cancelled");
    expect(store.state.conversationDrafts).toHaveLength(0);
  });

  it("claims a queued run once when two workers receive the same run ID", async () => {
    const store = makeStore();
    const { conversation, userMessage } = await startConversation(store);
    await updateEditorialConversationRun(store, { workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-race", status: "queued", metadata: createEditorialConversationProgress("en") });
    const provider = { generateJSON: vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 8));
      return { output: validOutput, provider: "openai-compatible", model: "test-model", usage: { totalTokens: 50 } };
    }) };
    const args = { store, provider, workspaceId: "workspace-1", conversationId: conversation.id, runId: "run-race", userMessageId: userMessage.id, mediaDir: "/tmp/editorial-chat-no-media" };
    const outcomes = await Promise.all([runEditorialConversation(args), runEditorialConversation(args)]);
    expect(outcomes.filter(item => item.status === "completed")).toHaveLength(1);
    expect(outcomes.filter(item => item.status === "ignored")).toHaveLength(1);
    expect(provider.generateJSON).toHaveBeenCalledTimes(1);
    expect(store.state.conversationDrafts).toHaveLength(1);
  });
});
