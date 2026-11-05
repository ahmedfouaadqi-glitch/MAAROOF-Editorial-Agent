import { randomUUID } from "node:crypto";
import { resolveEditorialIdentities } from "./editorial-identities.mjs";
import { getEditorialTarget } from "./editorial-targets.mjs";

const MAX_MESSAGE_CHARS = 20_000;
const MAX_TITLE_CHARS = 160;
const MAX_MESSAGES = 500;
const MAX_ATTACHMENTS = 10;
const MESSAGE_ROLES = new Set(["user", "assistant", "system"]);
const RUN_STATUSES = new Set(["queued", "running", "completed", "failed", "cancelled"]);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function requiredString(value, field, max, min = 1) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    fail(`${field} must contain ${min}-${max} characters`);
  }
  return value.trim();
}

function validId(value, field) {
  const id = requiredString(value, field, 128);
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) fail(`${field} must be a simple catalog ID`);
  return id;
}

function ownedConversation(state, workspaceId, conversationId) {
  const conversation = (state.editorialConversations || []).find(item => item.id === conversationId && item.workspaceId === workspaceId);
  if (!conversation) fail("Editorial conversation not found", 404);
  return conversation;
}

function safeAttachment(asset) {
  return {
    id: asset.id,
    originalName: asset.originalName,
    kind: asset.kind,
    mimeType: asset.mimeType,
    description: asset.description || "",
    sizeBytes: asset.sizeBytes,
    createdAt: asset.createdAt
  };
}

function conversationWithAttachments(state, conversation) {
  const attachments = state.conversationAttachments || [];
  return {
    ...structuredClone(conversation),
    messages: conversation.messages.map(message => ({
      ...structuredClone(message),
      attachments: (message.attachmentIds || []).map(id => attachments.find(asset =>
        asset.id === id && asset.workspaceId === conversation.workspaceId && asset.conversationId === conversation.id
      )).filter(Boolean).map(safeAttachment)
    }))
  };
}

function validateAttachments(state, workspaceId, conversationId, attachmentIds) {
  if (attachmentIds == null) return [];
  if (!Array.isArray(attachmentIds) || attachmentIds.length > MAX_ATTACHMENTS || attachmentIds.some(id => typeof id !== "string" || !id.trim())) {
    fail(`attachmentIds must contain at most ${MAX_ATTACHMENTS} valid IDs`);
  }
  const ids = [...new Set(attachmentIds)];
  if (ids.length !== attachmentIds.length) fail("Duplicate attachment IDs are not allowed");
  for (const id of ids) {
    const asset = (state.conversationAttachments || []).find(item =>
      item.id === id && item.workspaceId === workspaceId && item.conversationId === conversationId
    );
    if (!asset) fail("Attachment not found for this conversation and workspace", 404);
  }
  return ids;
}

export async function createEditorialConversation(store, {
  workspaceId, title = "", clientId, brandId, clientName, brandName,
  targetId, language = "ar"
}) {
  requiredString(workspaceId, "workspaceId", 128);
  const cleanTargetId = validId(targetId, "targetId");
  const target = getEditorialTarget(cleanTargetId);
  const cleanTitle = title === "" ? "" : requiredString(title, "title", MAX_TITLE_CHARS);
  if (language !== "ar" && language !== "en") fail("language must be ar or en");
  return store.transact(state => {
    const identities = resolveEditorialIdentities(state, { workspaceId, clientId, brandId, clientName, brandName });
    const now = new Date().toISOString();
    const conversation = {
      id: randomUUID(), workspaceId, title: cleanTitle,
      ...identities,
      targetId: cleanTargetId, targetName: target.name, language,
      createdAt: now, updatedAt: now, status: "open", messages: [], activeRun: null
    };
    state.editorialConversations ||= [];
    state.editorialConversations.push(conversation);
    return structuredClone(conversation);
  });
}

export async function listEditorialConversations(store, workspaceId) {
  requiredString(workspaceId, "workspaceId", 128);
  const state = await store.read();
  return (state.editorialConversations || [])
    .filter(item => item.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(item => ({
      id: item.id, workspaceId: item.workspaceId, title: item.title,
      clientId: item.clientId || null, clientName: item.clientName || null,
      brandId: item.brandId || null, brandName: item.brandName || null,
      targetId: item.targetId, targetName: item.targetName, language: item.language,
      status: item.status, activeRun: structuredClone(item.activeRun),
      createdAt: item.createdAt, updatedAt: item.updatedAt,
      lastMessagePreview: item.messages?.at(-1)?.content?.slice(0, 180) || ""
    }));
}

export async function getEditorialConversation(store, workspaceId, conversationId) {
  const state = await store.read();
  return conversationWithAttachments(state, ownedConversation(state, workspaceId, conversationId));
}

export async function appendEditorialConversationMessage(store, {
  workspaceId, conversationId, role, content, attachmentIds = [], clientMessageId, targetId, language, result = null
}) {
  if (!MESSAGE_ROLES.has(role)) fail("role must be user, assistant, or system");
  const cleanContent = requiredString(content, "content", MAX_MESSAGE_CHARS);
  if (language != null && language !== "ar" && language !== "en") fail("language must be ar or en");
  if (clientMessageId != null) requiredString(clientMessageId, "clientMessageId", 128);
  if (result != null && (typeof result !== "object" || Array.isArray(result) || JSON.stringify(result).length > 60_000)) fail("result must be a bounded object or null");
  return store.transact(state => {
    const conversation = ownedConversation(state, workspaceId, conversationId);
    const selectedTarget = targetId == null ? null : getEditorialTarget(validId(targetId, "targetId"));
    const attachments = validateAttachments(state, workspaceId, conversationId, attachmentIds);
    if (clientMessageId) {
      const existing = conversation.messages.find(message => message.clientMessageId === clientMessageId);
      if (existing) {
        if (existing.role !== role || existing.content !== cleanContent || JSON.stringify(existing.attachmentIds) !== JSON.stringify(attachments) || (selectedTarget && existing.targetId !== selectedTarget.id) || (language && (existing.language || conversation.language) !== language)) {
          fail("clientMessageId was already used for different content", 409);
        }
        return {
          ...structuredClone(existing), replayed: true,
          attachments: attachments.map(id => safeAttachment((state.conversationAttachments || []).find(item => item.id === id)) )
        };
      }
    }
    if (conversation.messages.length >= MAX_MESSAGES) fail("Conversation message limit reached", 409);
    if (selectedTarget) {
      conversation.targetId = selectedTarget.id;
      conversation.targetName = selectedTarget.name;
    }
    if (language) conversation.language = language;
    const createdAt = new Date().toISOString();
    const message = {
      id: randomUUID(), role, content: cleanContent, attachmentIds: attachments,
      targetId: conversation.targetId, language: conversation.language,
      createdAt, ...(clientMessageId ? { clientMessageId } : {}), ...(result == null ? {} : { result: structuredClone(result) })
    };
    conversation.messages.push(message);
    if (!conversation.title && role === "user") conversation.title = cleanContent.slice(0, 60);
    conversation.updatedAt = createdAt;
    return {
      ...structuredClone(message), replayed: false,
      attachments: attachments.map(id => safeAttachment((state.conversationAttachments || []).find(item => item.id === id)))
    };
  });
}

export async function claimEditorialConversationRun(store, { workspaceId, conversationId, runId }) {
  requiredString(runId, "runId", 128);
  return store.transact(state => {
    const conversation = ownedConversation(state, workspaceId, conversationId);
    if (!conversation.activeRun || conversation.activeRun.id !== runId || conversation.activeRun.status !== "queued") return false;
    const now = new Date().toISOString();
    conversation.activeRun = {
      ...conversation.activeRun, status: "running", updatedAt: now,
      metadata: { ...(conversation.activeRun.metadata || {}), claimedAt: now }
    };
    conversation.updatedAt = now;
    return true;
  });
}

export async function updateEditorialConversationRun(store, {
  workspaceId, conversationId, runId, status, metadata = null
}) {
  requiredString(runId, "runId", 128);
  if (!RUN_STATUSES.has(status)) fail("Unsupported run status");
  if (metadata != null && (typeof metadata !== "object" || Array.isArray(metadata))) fail("metadata must be an object or null");
  return store.transact(state => {
    const conversation = ownedConversation(state, workspaceId, conversationId);
    if (conversation.activeRun && conversation.activeRun.id !== runId && !["completed", "failed", "cancelled"].includes(conversation.activeRun.status)) {
      fail("Another run is already active", 409);
    }
    if (conversation.activeRun?.id === runId && ["completed", "failed", "cancelled"].includes(conversation.activeRun.status) && status !== conversation.activeRun.status) {
      fail("A finished run cannot be reopened or changed", 409);
    }
    const now = new Date().toISOString();
    conversation.activeRun = { id: runId, status, ...(metadata == null ? {} : { metadata: structuredClone(metadata) }), updatedAt: now };
    conversation.updatedAt = now;
    return structuredClone(conversation.activeRun);
  });
}


/** Mark in-flight runs as retryable failures after a process restart.
 * We deliberately do not replay work automatically: a future tool may have caused
 * an external side effect before the process died, so replay requires explicit review.
 */
export async function recoverInterruptedEditorialConversationRuns(store, { now = () => new Date().toISOString() } = {}) {
  return store.transact(state => {
    let recovered = 0;
    for (const conversation of state.editorialConversations || []) {
      const run = conversation?.activeRun;
      if (!run || !["queued", "running"].includes(run.status)) continue;
      const interruptedStatus = run.status;
      const timestamp = now();
      conversation.activeRun = {
        ...run,
        status: "failed",
        updatedAt: timestamp,
        metadata: {
          ...(run.metadata || {}),
          error: "process-restarted",
          interruptedStatus,
          retryable: true,
          recoveredAt: timestamp,
          recoveryNote: "The server restarted before this run reached a terminal state. It was not replayed automatically to avoid duplicate side effects."
        }
      };
      conversation.updatedAt = timestamp;
      recovered += 1;
    }
    return { recovered };
  });
}
