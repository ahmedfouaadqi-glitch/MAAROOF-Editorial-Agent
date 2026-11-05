import { describe, expect, it, vi } from "vitest";
import {
  appendEditorialConversationMessage,
  claimEditorialConversationRun,
  createEditorialConversation,
  getEditorialConversation,
  listEditorialConversations,
  updateEditorialConversationRun,
  recoverInterruptedEditorialConversationRuns,
  enqueueEditorialConversationJob,
  claimNextEditorialConversationJob,
  finishEditorialConversationJob
} from "./editorial-conversations.mjs";

function initialState() {
  return {
    clients: [], brands: [], conversationAttachments: [], editorialConversations: [] as any[], editorialJobQueue: [] as any[]
  };
}
function makeStore(state = initialState()) {
  return {
    state,
    read: vi.fn(async () => structuredClone(state)),
    transact: vi.fn(async (mutator: (value: typeof state) => unknown) => mutator(state))
  };
}

describe("editorial conversations", () => {
  it("creates, lists and gets a conversation scoped to its workspace and target", async () => {
    const store = makeStore();
    const conversation = await createEditorialConversation(store, {
      workspaceId: "workspaceA", targetId: "instagram", targetName: "Instagram", title: "Brand launch", language: "en",
      clientName: "Client A", brandName: "Brand A"
    });
    expect(conversation).toMatchObject({
      workspaceId: "workspaceA", title: "Brand launch", targetId: "instagram", targetName: "Instagram",
      clientName: "Client A", brandName: "Brand A", status: "open", messages: [], activeRun: null
    });
    expect(await listEditorialConversations(store, "workspaceA")).toHaveLength(1);
    expect(await listEditorialConversations(store, "workspaceB")).toHaveLength(0);
    await expect(getEditorialConversation(store, "workspaceB", conversation.id)).rejects.toMatchObject({ status: 404 });
    expect(await getEditorialConversation(store, "workspaceA", conversation.id)).toEqual(conversation);
  });

  it("rejects unsafe target IDs, invalid identities and oversized titles", async () => {
    const store = makeStore();
    await expect(createEditorialConversation(store, { workspaceId: "workspaceA", targetId: "https://example.com" })).rejects.toMatchObject({ status: 400 });
    await expect(createEditorialConversation(store, { workspaceId: "workspaceA", targetId: "medium", brandName: "x" })).rejects.toMatchObject({ status: 400 });
    await expect(createEditorialConversation(store, { workspaceId: "workspaceA", targetId: "medium", title: "x".repeat(161) })).rejects.toMatchObject({ status: 400 });
    expect(store.state.editorialConversations).toHaveLength(0);
  });

  it("validates attachment ownership and supports idempotent message append", async () => {
    const store = makeStore();
    const conversation = await createEditorialConversation(store, { workspaceId: "workspaceA", targetId: "medium" });
    store.state.conversationAttachments.push(
      { id: "assetA", workspaceId: "workspaceA", conversationId: conversation.id, originalName: "brief.txt", kind: "document", mimeType: "text/plain", sizeBytes: 12, createdAt: "2026-11-04T00:00:00.000Z" },
      { id: "assetOtherConversation", workspaceId: "workspaceA", conversationId: "other", originalName: "other.png" },
      { id: "assetOtherWorkspace", workspaceId: "workspaceB", conversationId: conversation.id, originalName: "foreign.png" }
    );
    await expect(appendEditorialConversationMessage(store, { workspaceId: "workspaceA", conversationId: conversation.id, role: "tool", content: "x" })).rejects.toMatchObject({ status: 400 });
    for (const attachmentId of ["missing", "assetOtherConversation", "assetOtherWorkspace"]) {
      await expect(appendEditorialConversationMessage(store, { workspaceId: "workspaceA", conversationId: conversation.id, role: "user", content: "Please review this asset", attachmentIds: [attachmentId] })).rejects.toMatchObject({ status: 404 });
    }
    const args = { workspaceId: "workspaceA", conversationId: conversation.id, role: "user", content: "Review this text file", attachmentIds: ["assetA"], clientMessageId: "client-msg-1", language: "en" };
    const first = await appendEditorialConversationMessage(store, args);
    const duplicate = await appendEditorialConversationMessage(store, args);
    expect(duplicate.id).toBe(first.id);
    expect(duplicate.replayed).toBe(true);
    expect(duplicate.attachments).toEqual(first.attachments);
    expect(first.language).toBe("en");
    expect(store.state.editorialConversations[0].language).toBe("en");
    expect(first.attachments).toMatchObject([{ id: "assetA", originalName: "brief.txt", kind: "document" }]);
    expect(store.state.editorialConversations[0].messages).toHaveLength(1);
    await expect(appendEditorialConversationMessage(store, { ...args, content: "Different text" })).rejects.toMatchObject({ status: 409 });
  });

  it("creates and updates run state while preventing concurrent or reopened runs", async () => {
    const store = makeStore();
    const conversation = await createEditorialConversation(store, { workspaceId: "workspaceA", targetId: "medium" });
    expect(await updateEditorialConversationRun(store, { workspaceId: "workspaceA", conversationId: conversation.id, runId: "run-1", status: "queued" })).toMatchObject({ id: "run-1", status: "queued" });
    expect(await claimEditorialConversationRun(store, { workspaceId: "workspaceA", conversationId: conversation.id, runId: "run-1" })).toBe(true);
    expect(await claimEditorialConversationRun(store, { workspaceId: "workspaceA", conversationId: conversation.id, runId: "run-1" })).toBe(false);
    await updateEditorialConversationRun(store, { workspaceId: "workspaceA", conversationId: conversation.id, runId: "run-1", status: "running", metadata: { phase: "draft" } });
    await expect(updateEditorialConversationRun(store, { workspaceId: "workspaceA", conversationId: conversation.id, runId: "run-2", status: "running" })).rejects.toMatchObject({ status: 409 });
    await updateEditorialConversationRun(store, { workspaceId: "workspaceA", conversationId: conversation.id, runId: "run-1", status: "completed" });
    await expect(updateEditorialConversationRun(store, { workspaceId: "workspaceA", conversationId: conversation.id, runId: "run-1", status: "running" })).rejects.toMatchObject({ status: 409 });
    await expect(updateEditorialConversationRun(store, { workspaceId: "workspaceB", conversationId: conversation.id, runId: "run-2", status: "running" })).rejects.toMatchObject({ status: 404 });
    expect((await getEditorialConversation(store, "workspaceA", conversation.id)).activeRun).toMatchObject({ id: "run-1", status: "completed" });
  });
  it("persists queue jobs, deduplicates enqueue, and atomically claims each job once", async () => {
    const store = makeStore();
    const conversation = await createEditorialConversation(store, { workspaceId: "workspaceA", targetId: "medium" });
    const args = { workspaceId: "workspaceA", conversationId: conversation.id, runId: "durable-run-1", userMessageId: "message-1", mediaDir: "/safe/media" };
    const first = await enqueueEditorialConversationJob(store, args);
    const replay = await enqueueEditorialConversationJob(store, args);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(store.state.editorialJobQueue).toHaveLength(1);
    await expect(enqueueEditorialConversationJob(store, { ...args, userMessageId: "different-message" })).rejects.toMatchObject({ status: 409 });
    const claims = await Promise.all([claimNextEditorialConversationJob(store), claimNextEditorialConversationJob(store)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)).toMatchObject({ id: "durable-run-1", status: "running", attempts: 1 });
    expect(await finishEditorialConversationJob(store, "durable-run-1", "completed")).toMatchObject({ status: "completed" });
    expect(await claimNextEditorialConversationJob(store)).toBeNull();
  });

  it("preserves never-claimed queued jobs and marks uncertain running jobs failed after restart", async () => {
    const state = initialState();
    state.editorialJobQueue = [
      { id: "safe-queued", type: "editorial-conversation", status: "queued", createdAt: "2026-11-05T00:00:00.000Z" },
      { id: "uncertain-running", type: "editorial-conversation", status: "running", createdAt: "2026-11-05T00:01:00.000Z" }
    ];
    state.editorialConversations = [
      { id: "queued-conversation", workspaceId: "workspaceA", activeRun: { id: "safe-queued", status: "queued", metadata: {} } },
      { id: "running-conversation", workspaceId: "workspaceA", activeRun: { id: "uncertain-running", status: "running", metadata: {} } }
    ] as any;
    const store = makeStore(state);
    const result = await recoverInterruptedEditorialConversationRuns(store, { now: () => "2026-11-05T12:00:00.000Z" });
    expect(result).toEqual({ recovered: 1, recoveredJobs: 1 });
    expect(state.editorialJobQueue[0].status).toBe("queued");
    expect(state.editorialJobQueue[1]).toMatchObject({ status: "failed", errorCode: "process-restarted" });
    expect(state.editorialConversations[0].activeRun.status).toBe("queued");
    expect(state.editorialConversations[1].activeRun).toMatchObject({ status: "failed", metadata: { error: "process-restarted", retryable: true } });
  });

  it("recovers queued and running runs as retryable failures without replaying them", async () => {
    const state = initialState();
    state.editorialConversations = [
      { id: "queued", workspaceId: "workspaceA", updatedAt: "old", activeRun: { id: "run-q", status: "queued", metadata: { retryCount: 1 } } },
      { id: "running", workspaceId: "workspaceA", updatedAt: "old", activeRun: { id: "run-r", status: "running", metadata: { phase: "draft" } } },
      { id: "done", workspaceId: "workspaceA", updatedAt: "old", activeRun: { id: "run-d", status: "completed", metadata: {} } },
      { id: "empty", workspaceId: "workspaceA", updatedAt: "old", activeRun: null }
    ] as any;
    const store = makeStore(state);
    const result = await recoverInterruptedEditorialConversationRuns(store, { now: () => "2026-11-05T12:00:00.000Z" });
    expect(result).toEqual({ recovered: 2, recoveredJobs: 0 });
    expect(state.editorialConversations[0].activeRun).toMatchObject({
      id: "run-q", status: "failed", metadata: { error: "process-restarted", interruptedStatus: "queued", retryable: true, retryCount: 1, recoveredAt: "2026-11-05T12:00:00.000Z" }
    });
    expect(state.editorialConversations[1].activeRun).toMatchObject({
      id: "run-r", status: "failed", metadata: { error: "process-restarted", interruptedStatus: "running", retryable: true, phase: "draft" }
    });
    expect(state.editorialConversations[2].activeRun.status).toBe("completed");
    expect(state.editorialConversations[3].activeRun).toBeNull();
  });

});
