import { randomUUID } from "node:crypto";
import { normalizeEditorialText } from "./editorial-evidence.mjs";

const SEARCH_INTENTS = new Set(["informational", "commercial", "transactional", "navigational", "local"]);

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

function articleDraft(state, workspaceId, taskId) {
  return (state.editorialDrafts || []).find(item => item.workspaceId === workspaceId && item.taskId === taskId) || null;
}

function cleanText(value, field, { min = 0, max = 300 } = {}) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) fail(`${field} must contain ${min}-${max} characters`);
  return value.trim();
}

function uniqueTexts(values, field, maxItems, maxLength) {
  if (!Array.isArray(values) || values.length > maxItems) fail(`${field} must be an array of up to ${maxItems} values`);
  const output = [];
  const seen = new Set();
  for (const value of values) {
    const item = cleanText(value, field, { min: 2, max: maxLength });
    const normalized = normalizeEditorialText(item);
    if (!seen.has(normalized)) { output.push(item); seen.add(normalized); }
  }
  return output;
}

function phraseOccurrences(text, phrase) {
  const normalizedText = normalizeEditorialText(text);
  const normalizedPhrase = normalizeEditorialText(phrase);
  if (!normalizedText || !normalizedPhrase) return 0;
  const haystack = ` ${normalizedText} `;
  const needle = ` ${normalizedPhrase} `;
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) { count++; offset += needle.length; }
  return count;
}

function emptyBrief() {
  return { intent: "", primaryQuery: "", supportingTerms: [], targetQuestions: [], targetEntityIds: [], updatedAt: null };
}

export function updateGeoBrief(state, { workspaceId, taskId, intent, primaryQuery, supportingTerms = [], targetQuestions = [], targetEntityIds = [] }) {
  taskFor(state, workspaceId, taskId);
  const draft = articleDraft(state, workspaceId, taskId);
  if (!draft) fail("Create an article outline before setting its GEO brief", 409);
  if (typeof intent !== "string" || (intent !== "" && !SEARCH_INTENTS.has(intent))) fail("Unsupported search intent");
  const cleanedPrimaryQuery = cleanText(primaryQuery ?? "", "primaryQuery", { min: 0, max: 160 });
  const cleanedTerms = uniqueTexts(supportingTerms, "supportingTerms", 12, 160);
  if (!Array.isArray(targetQuestions) || targetQuestions.length > 12) fail("targetQuestions must be an array of up to 12 questions");
  const sections = draft.sections || [];
  const sectionIds = new Set(sections.map(section => section.id));
  const currentEvidence = (state.researchEvidence || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const evidenceIdsAllowed = new Set(currentEvidence.map(item => item.id));
  const seenQuestions = new Set();
  const cleanedQuestions = targetQuestions.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail("Each target question must be an object");
    const question = cleanText(item.question, "target question", { min: 8, max: 300 });
    const normalized = normalizeEditorialText(question);
    if (seenQuestions.has(normalized)) fail("Duplicate target questions are not allowed");
    seenQuestions.add(normalized);
    const sectionId = item.sectionId == null ? "" : cleanText(item.sectionId, "sectionId", { min: 0, max: 128 });
    if (sectionId && !sectionIds.has(sectionId)) fail("Target question section must belong to this article", 404);
    const evidenceIds = item.evidenceIds ?? [];
    if (!Array.isArray(evidenceIds) || evidenceIds.length > 8 || evidenceIds.some(id => typeof id !== "string")) fail("Each question may link to up to 8 evidence records");
    const uniqueEvidenceIds = [...new Set(evidenceIds)];
    if (uniqueEvidenceIds.some(id => !evidenceIdsAllowed.has(id))) fail("Question evidence must belong to this workspace and article", 404);
    const id = typeof item.id === "string" && item.id.length <= 128 ? item.id : randomUUID();
    return { id, question, sectionId, evidenceIds: uniqueEvidenceIds };
  });
  if (!Array.isArray(targetEntityIds) || targetEntityIds.length > 20 || targetEntityIds.some(id => typeof id !== "string")) fail("targetEntityIds must be an array of up to 20 entity IDs");
  const uniqueEntityIds = [...new Set(targetEntityIds)];
  const allowedEntityIds = new Set((state.entities || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId).map(item => item.id));
  if (uniqueEntityIds.some(id => !allowedEntityIds.has(id))) fail("Target entities must be registered in this workspace and article", 404);

  draft.geoBrief = {
    intent,
    primaryQuery: cleanedPrimaryQuery,
    supportingTerms: cleanedTerms,
    targetQuestions: cleanedQuestions,
    targetEntityIds: uniqueEntityIds,
    updatedAt: new Date().toISOString()
  };
  return getGeoReadiness(state, workspaceId, taskId);
}

export function getGeoReadiness(state, workspaceId, taskId) {
  taskFor(state, workspaceId, taskId);
  const draft = articleDraft(state, workspaceId, taskId);
  const brief = draft?.geoBrief || emptyBrief();
  const articleText = draft ? [draft.title, draft.dek, draft.editorialAngle, ...(draft.sections || []).flatMap(section => [section.heading, section.body])].filter(Boolean).join(" ") : "";
  const claims = (state.claims || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const evidence = (state.researchEvidence || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const sources = (state.sources || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const entities = (state.entities || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const links = (state.entityClaimLinks || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const sections = draft?.sections || [];

  const questionCoverage = (brief.targetQuestions || []).map(item => {
    const section = sections.find(candidate => candidate.id === item.sectionId);
    const linkedEvidence = evidence.filter(record => item.evidenceIds.includes(record.id));
    const supporting = linkedEvidence.filter(record => record.stance === "supports");
    const contradictory = linkedEvidence.filter(record => record.stance === "contradicts");
    const hasSectionText = Boolean(section?.body?.trim());
    const status = !section || !hasSectionText || !supporting.length ? "incomplete" : contradictory.length ? "conflicting-evidence-review" : "evidence-linked-review";
    return {
      id: item.id,
      question: item.question,
      sectionId: item.sectionId,
      sectionHeading: section?.heading || "",
      linkedEvidenceCount: linkedEvidence.length,
      supportingEvidenceCount: supporting.length,
      contradictoryEvidenceCount: contradictory.length,
      answerSectionHasText: hasSectionText,
      status
    };
  });

  const entityCoverage = (brief.targetEntityIds || []).map(id => {
    const entity = entities.find(item => item.id === id);
    if (!entity) return { id, name: id, mentioned: false, linkedClaimCount: 0, evidenceCount: 0, status: "missing-entity" };
    const labels = [entity.canonicalName, ...(entity.aliases || [])];
    const mentioned = labels.some(label => phraseOccurrences(articleText, label) > 0);
    const claimIds = [...new Set(links.filter(link => link.entityId === id).map(link => link.claimId))];
    const linkedClaims = claims.filter(claim => claimIds.includes(claim.id) && claim.sourceIds?.length);
    const evidenceCount = evidence.filter(item => linkedClaims.some(claim => claim.id === item.claimId)).length;
    return {
      id,
      name: entity.canonicalName,
      mentioned,
      linkedClaimCount: linkedClaims.length,
      evidenceCount,
      status: mentioned && evidenceCount ? "mentioned-with-linked-evidence-review" : mentioned ? "mentioned-needs-evidence" : evidenceCount ? "evidence-linked-needs-natural-mention" : "needs-mention-and-evidence"
    };
  });

  const termCoverage = [brief.primaryQuery, ...(brief.supportingTerms || [])].filter(Boolean).map(term => ({ term, occurrences: phraseOccurrences(articleText, term) }));
  const questionReady = questionCoverage.length > 0 && questionCoverage.every(item => item.answerSectionHasText && item.supportingEvidenceCount > 0);
  const entityReady = entityCoverage.length > 0 && entityCoverage.every(item => item.mentioned && item.evidenceCount > 0);
  const checks = [
    { id: "intent", status: brief.intent ? "pass" : "missing", detail: brief.intent || "Choose one search intent; this is an editorial assumption, not a measured query report." },
    { id: "primary-query", status: brief.primaryQuery ? "pass" : "missing", detail: brief.primaryQuery ? `${termCoverage[0]?.occurrences || 0} exact normalized occurrence(s) in the current draft.` : "Set one editor-selected primary query phrase." },
    { id: "supporting-terms", status: (brief.supportingTerms || []).length ? "review" : "missing", detail: (brief.supportingTerms || []).length ? `${brief.supportingTerms.length} supporting phrase(s) set; absent phrases are suggestions, not a reason to repeat them.` : "Add only specific, relevant supporting phrases; do not add a phrase just to raise a count." },
    { id: "questions", status: questionCoverage.length ? (questionReady ? "review" : "missing") : "missing", detail: questionCoverage.length ? `${questionCoverage.filter(item => item.answerSectionHasText && item.supportingEvidenceCount > 0).length}/${questionCoverage.length} questions map to a non-empty section with at least one supporting excerpt. Human review is still required.` : "Add target questions only when relevant to the article." },
    { id: "entities", status: entityCoverage.length ? (entityReady ? "review" : "missing") : "missing", detail: entityCoverage.length ? `${entityCoverage.filter(item => item.mentioned && item.evidenceCount > 0).length}/${entityCoverage.length} selected entities are mentioned and linked to recorded claim evidence.` : "Select relevant entities from this article's registry; no entity is inferred automatically." },
    { id: "editorial-angle", status: draft?.editorialAngle?.trim() ? "pass" : "missing", detail: draft?.editorialAngle?.trim() ? "A distinct editorial angle is present." : "Write a distinct angle rather than repeating generic topic copy." },
    { id: "source-freshness", status: sources.length ? "review" : "missing", detail: sources.length ? `${sources.filter(item => item.research?.publishedAt || item.research?.updatedAt).length}/${sources.length} sources have a recorded publication/update date; recency and validity are not independently verified.` : "Register relevant sources before relying on factual claims." }
  ];
  const status = checks.some(check => check.status === "missing") ? "incomplete" : "ready-for-editor-review";
  return {
    brief,
    readiness: {
      status,
      checks,
      termCoverage,
      questionCoverage,
      entityCoverage,
      limitations: [
        "This is an internal editorial checklist, not a ranking score or a promise of citations/visibility in search or answer engines.",
        "Search intent and phrases are editor-supplied, not measured keyword-volume data.",
        "Recorded excerpts are manually entered and unverified; a linked excerpt is not proof that a question is correctly answered.",
        "Term occurrence counts are descriptive only. Do not repeat phrases unnaturally to increase them.",
        "Freshness is not independently verified."
      ]
    }
  };
}

export function getGeoBrief(state, workspaceId, taskId) {
  taskFor(state, workspaceId, taskId);
  return getGeoReadiness(state, workspaceId, taskId);
}
