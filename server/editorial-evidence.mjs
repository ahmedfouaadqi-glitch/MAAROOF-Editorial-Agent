import { createHash, randomUUID } from "node:crypto";
import { compareWorkspaceEditorialContent, normalizeEditorialText } from "./editorial-similarity.mjs";

export { normalizeEditorialText };

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

function fingerprint(normalized) {
  return createHash("sha256").update(normalized).digest("hex");
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
  const article = state.tasks?.[taskId]?.article || {};
  const comparisons = compareWorkspaceEditorialContent(state, workspaceId, text, {
    excludeArticleTaskIds: [taskId], excludeSocialTaskIds: [taskId], excludeCheckTaskIds: [taskId],
    clientId: article.clientId || null, brandId: article.brandId || null, nearDuplicateThreshold
  });
  const exact = comparisons.exactMatches[0] || null;
  const result = {
    id: randomUUID(),
    workspaceId,
    taskId,
    fingerprint: hash,
    normalizedText: normalized,
    checkedAt: new Date().toISOString(),
    outcome: exact ? "exact-match" : comparisons.nearMatches.length ? "possible-near-duplicate" : "no-match-found",
    exactMatchTaskId: exact?.taskId || null,
    exactMatchContentType: exact?.contentType || null,
    exactMatches: comparisons.exactMatches,
    nearMatches: comparisons.nearMatches,
    comparisonScope: comparisons.comparisonScope,
    comparedContentCount: comparisons.comparedContentCount,
    comparedByType: comparisons.comparedByType,
    method: "normalized-sha256-and-token-jaccard",
    limitations: [
      "Compares saved article and social drafts assigned to the same client, or to the same standalone brand; legacy unassigned content is included as a separate candidate category.",
      "Content assigned to a different client is excluded; current identity is metadata only and is not an authorization boundary.",
      "Token overlap is a deterministic heuristic, not semantic similarity or a plagiarism verdict.",
      "Other workspaces, translated paraphrases, external websites, and unrecorded content are not checked."
    ]
  };
  state.originalityChecks.push(result);
  const { normalizedText: _privateInternal, ...publicResult } = result;
  return publicResult;
}
