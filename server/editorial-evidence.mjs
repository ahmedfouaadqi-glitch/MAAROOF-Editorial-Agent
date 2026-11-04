import { createHash, randomUUID } from "node:crypto";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function taskFor(state, workspaceId, taskId) {
  const task = state.tasks?.[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) fail("Editorial task not found", 404);
  return task;
}

export function normalizeEditorialText(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fingerprint(normalized) {
  return createHash("sha256").update(normalized).digest("hex");
}

function tokenSet(normalized) {
  return new Set(normalized.split(" ").filter(Boolean));
}

function jaccard(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function registerClaim(state, { workspaceId, taskId, text, sourceIds = [] }) {
  taskFor(state, workspaceId, taskId);
  if (typeof text !== "string" || text.trim().length < 8 || text.length > 2000) {
    fail("Claim text must contain 8-2000 characters");
  }
  if (!Array.isArray(sourceIds) || sourceIds.length > 20 || sourceIds.some(id => typeof id !== "string")) {
    fail("sourceIds must be an array of up to 20 source IDs");
  }
  const uniqueIds = [...new Set(sourceIds)];
  const sources = state.sources || [];
  for (const sourceId of uniqueIds) {
    if (!sources.some(source => source.id === sourceId && source.workspaceId === workspaceId && source.taskId === taskId)) {
      fail("Every linked source must belong to this workspace and article", 404);
    }
  }
  const claim = {
    id: randomUUID(),
    workspaceId,
    taskId,
    text: text.trim(),
    sourceIds: uniqueIds,
    evidenceState: uniqueIds.length ? "source-linked-unverified" : "unlinked",
    createdAt: new Date().toISOString()
  };
  state.claims ||= [];
  state.claims.push(claim);
  return claim;
}

export function listClaims(state, workspaceId, taskId) {
  taskFor(state, workspaceId, taskId);
  const claims = (state.claims || []).filter(claim => claim.workspaceId === workspaceId && claim.taskId === taskId);
  const linked = claims.filter(claim => claim.sourceIds.length > 0).length;
  return {
    claims,
    summary: {
      total: claims.length,
      sourceLinked: linked,
      unlinked: claims.length - linked,
      coveragePercent: claims.length ? Math.round((linked / claims.length) * 100) : 0,
      note: "Source linkage is not source verification or proof that a claim is true."
    }
  };
}

export function checkOriginality(state, { workspaceId, taskId, text, nearDuplicateThreshold = 0.82 }) {
  taskFor(state, workspaceId, taskId);
  if (typeof text !== "string" || text.trim().length < 30 || text.length > 100_000) {
    fail("Text must contain 30-100000 characters");
  }
  const normalized = normalizeEditorialText(text);
  if (normalized.length < 20) fail("Text is too short after normalization");
  const hash = fingerprint(normalized);
  state.originalityChecks ||= [];
  const previous = state.originalityChecks.filter(item => item.workspaceId === workspaceId && item.taskId !== taskId);
  const exact = previous.find(item => item.fingerprint === hash);
  const comparisons = previous
    .filter(item => item.normalizedText.split(" ").length >= 8 && normalized.split(" ").length >= 8)
    .map(item => ({ item, similarity: jaccard(normalized, item.normalizedText) }))
    .filter(item => item.similarity >= nearDuplicateThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
  const result = {
    id: randomUUID(),
    workspaceId,
    taskId,
    fingerprint: hash,
    normalizedText: normalized,
    checkedAt: new Date().toISOString(),
    outcome: exact ? "exact-match" : comparisons.length ? "possible-near-duplicate" : "no-match-found",
    exactMatchTaskId: exact?.taskId || null,
    nearMatches: comparisons.map(({ item, similarity }) => ({
      taskId: item.taskId,
      similarity: Number(similarity.toFixed(4))
    })),
    method: "normalized-sha256-and-token-jaccard",
    limitations: [
      "Checks only text previously submitted to this workspace's originality endpoint.",
      "Token overlap is a deterministic heuristic, not semantic similarity.",
      "Cross-language paraphrases, external web content, and unpublished drafts are not checked."
    ]
  };
  state.originalityChecks.push(result);
  const { normalizedText: _privateInternal, ...publicResult } = result;
  return publicResult;
}
