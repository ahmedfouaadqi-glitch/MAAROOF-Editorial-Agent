import { describe, expect, it, vi } from "vitest";
import { appendEditorialConversationMessage, createEditorialConversation, getEditorialConversation, updateEditorialConversationRun } from "./editorial-conversations.mjs";
import { createEditorialConversationProgress, runEditorialConversation, cancelEditorialConversationRun } from "./editorial-conversation-runner.mjs";

function makeStore() {
  const state: any = {
    editorialConversations: [], conversationAttachments: [], conversationDrafts: [], clients: [], brands: [],
    editorialDrafts: [], platformVariants: [], originalityChecks: [], tasks: {}
  };
  return {
    state,
    read: vi.fn(async () => structuredClone(state)),
    transact: vi.fn(async (mutator: (value: any) => unknown) => mutator(state))
  };
}
async function startConversation(store: ReturnType<typeof makeStore>) {
  const conversation = await createEditorialConversation(store, {
    workspaceId: "workspace-1", targetId: "linkedin", language: "en", clientName: "Client A", brandName: "Brand A"
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
    expect(saved.activeRun?.metadata?.steps.find((step: any) => step.id === "discovery")?.status).toBe("skipped");
    expect(saved.activeRun?.metadata?.steps.find((step: any) => step.id === "draft")?.status).toBe("skipped");
    expect(saved.messages.at(-1)?.result).toMatchObject({ kind: "notice", code: "model-provider-unavailable" });
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
    expect(savedFirst.activeRun?.metadata?.steps.find((step: any) => step.id === "discovery")?.status).toBe("skipped");
    expect(savedFirst.activeRun?.metadata?.startedAt).toBeTruthy();
    expect(savedFirst.activeRun?.metadata?.finishedAt).toBeTruthy();

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
    expect(finalConversation.activeRun?.metadata?.steps.find((step: any) => step.id === "originality")?.status).toBe("needs-review");
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
