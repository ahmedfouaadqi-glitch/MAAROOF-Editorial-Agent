export function normalizeEditorialText(value) {
  return String(value ?? "")
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

function tokenSet(normalized) {
  return new Set(normalized.split(" ").filter(token => token.length > 1));
}

export function tokenJaccardSimilarity(left, right) {
  const a = tokenSet(normalizeEditorialText(left));
  const b = tokenSet(normalizeEditorialText(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function wordCount(value) {
  const normalized = normalizeEditorialText(value);
  return normalized ? normalized.split(" ").filter(Boolean).length : 0;
}

function articleDraftText(draft, task) {
  return [
    draft.title || "", draft.dek || "", draft.editorialAngle || "", draft.metaTitle || "", draft.metaDescription || "",
    task?.article?.topic || "",
    ...(draft.sections || []).flatMap(section => [section.heading || "", section.body || ""])
  ].filter(Boolean).join("\n");
}

function socialDraftText(variant) {
  return [variant.title || "", variant.hook || "", variant.body || "", variant.callToAction || "", ...(variant.hashtags || []), variant.videoScript || "", variant.onScreenText || ""].filter(Boolean).join("\n");
}

function conversationDraftText(draft) {
  return [draft.title || "", draft.hook || "", draft.body || "", draft.callToAction || "", ...(draft.hashtags || []), draft.videoScript || ""].filter(Boolean).join("\n");
}

function identityForTask(state, taskId) {
  const article = state.tasks?.[taskId]?.article || {};
  return {
    clientId: article.clientId || null,
    clientName: article.clientName || null,
    brandId: article.brandId || null,
    brandName: article.brandName || null
  };
}

function identityRelationship(item, { clientId, brandId }) {
  if (clientId && item.clientId === clientId) {
    if (brandId && item.brandId === brandId) return "same-brand";
    if (brandId && item.brandId && item.brandId !== brandId) return "same-client-other-brand";
    return "same-client";
  }
  if (!clientId && brandId && item.brandId === brandId) return "same-brand";
  if (!item.clientId && !item.brandId) return clientId || brandId ? "legacy-unassigned" : "unassigned-workspace";
  return null;
}

export function collectWorkspaceEditorialContent(state, workspaceId, {
  excludeArticleTaskIds = [],
  excludeSocialTaskIds = [],
  excludeCheckTaskIds = []
} = {}) {
  const excludedArticles = new Set(excludeArticleTaskIds);
  const excludedSocial = new Set(excludeSocialTaskIds);
  const excludedChecks = new Set(excludeCheckTaskIds);
  const tasksWithDrafts = new Set();
  const records = [];

  for (const draft of state.editorialDrafts || []) {
    if (draft.workspaceId !== workspaceId || excludedArticles.has(draft.taskId)) continue;
    const text = articleDraftText(draft, state.tasks?.[draft.taskId]);
    if (wordCount(text) < 1) continue;
    tasksWithDrafts.add(draft.taskId);
    records.push({
      taskId: draft.taskId,
      recordId: draft.id,
      contentType: "article-draft",
      title: draft.title || state.tasks?.[draft.taskId]?.article?.topic || "",
      ...identityForTask(state, draft.taskId),
      normalizedText: normalizeEditorialText(text)
    });
  }

  for (const variant of state.platformVariants || []) {
    if (variant.workspaceId !== workspaceId || excludedSocial.has(variant.taskId)) continue;
    const text = socialDraftText(variant);
    if (wordCount(text) < 1) continue;
    records.push({
      taskId: variant.taskId,
      recordId: variant.id,
      contentType: "social-draft",
      title: variant.title || variant.hook || variant.platformName || "",
      platformId: variant.platformId || "",
      ...identityForTask(state, variant.taskId),
      normalizedText: normalizeEditorialText(text)
    });
  }

  for (const draft of state.conversationDrafts || []) {
    if (draft.workspaceId !== workspaceId) continue;
    const text = conversationDraftText(draft);
    if (wordCount(text) < 1) continue;
    records.push({
      taskId: draft.conversationId,
      recordId: draft.id,
      contentType: "conversation-draft",
      title: draft.title || draft.targetName || "",
      platformId: draft.targetId || "",
      clientId: draft.clientId || null,
      clientName: draft.clientName || null,
      brandId: draft.brandId || null,
      brandName: draft.brandName || null,
      normalizedText: normalizeEditorialText(text)
    });
  }

  for (const check of state.originalityChecks || []) {
    if (check.workspaceId !== workspaceId || excludedChecks.has(check.taskId) || tasksWithDrafts.has(check.taskId)) continue;
    const normalizedText = typeof check.normalizedText === "string" ? normalizeEditorialText(check.normalizedText) : "";
    if (wordCount(normalizedText) < 1) continue;
    records.push({
      taskId: check.taskId,
      recordId: check.id,
      contentType: "previous-check",
      title: state.tasks?.[check.taskId]?.article?.topic || "",
      ...identityForTask(state, check.taskId),
      normalizedText
    });
  }
  return records;
}

export function compareWorkspaceEditorialContent(state, workspaceId, candidateText, {
  excludeArticleTaskIds = [],
  excludeSocialTaskIds = [],
  excludeCheckTaskIds = [],
  clientId = null,
  brandId = null,
  nearDuplicateThreshold = 0.82,
  maxMatches = 5
} = {}) {
  const normalizedCandidate = normalizeEditorialText(candidateText);
  const candidateWords = wordCount(normalizedCandidate);
  const scope = { clientId, brandId };
  const corpus = collectWorkspaceEditorialContent(state, workspaceId, { excludeArticleTaskIds, excludeSocialTaskIds, excludeCheckTaskIds })
    .map(item => ({ ...item, identityRelationship: identityRelationship(item, scope) }))
    .filter(item => item.identityRelationship);
  const exact = corpus.filter(item => item.normalizedText === normalizedCandidate);
  const nearMatches = candidateWords < 8 ? [] : corpus
    .filter(item => wordCount(item.normalizedText) >= 8 && item.normalizedText !== normalizedCandidate)
    .map(item => ({
      ...item,
      similarity: tokenJaccardSimilarity(normalizedCandidate, item.normalizedText)
    }))
    .filter(item => item.similarity >= nearDuplicateThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxMatches);
  const toPublic = item => item ? ({
    taskId: item.taskId,
    recordId: item.recordId,
    contentType: item.contentType,
    title: item.title,
    clientId: item.clientId,
    clientName: item.clientName,
    brandId: item.brandId,
    brandName: item.brandName,
    identityRelationship: item.identityRelationship,
    ...(item.platformId ? { platformId: item.platformId } : {}),
    similarity: item.similarity == null ? 1 : Number(item.similarity.toFixed(4))
  }) : null;
  const byType = Object.fromEntries(["article-draft", "social-draft", "conversation-draft", "previous-check"].map(type => [type, corpus.filter(item => item.contentType === type).length]));
  return {
    comparisonScope: clientId ? "same-client-plus-unassigned" : brandId ? "same-brand-plus-unassigned" : "unassigned-workspace-only",
    comparedContentCount: corpus.length,
    comparedByType: byType,
    exactMatches: exact.slice(0, maxMatches).map(toPublic),
    nearMatches: nearMatches.map(toPublic)
  };
}
