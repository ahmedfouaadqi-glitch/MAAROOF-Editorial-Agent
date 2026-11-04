import { randomUUID } from "node:crypto";

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
function boundedText(value, field, min, max, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || value.trim().length < min || value.length > max) fail(field + " must contain " + min + "-" + max + " characters");
  return value.trim();
}
function validDate(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) fail(field + " must be a valid ISO date or datetime");
  return new Date(value).toISOString();
}
function scopedSource(state, workspaceId, taskId, sourceId) {
  const source = (state.sources || []).find(item => item.id === sourceId && item.workspaceId === workspaceId && item.taskId === taskId);
  if (!source) fail("Source not found in this workspace and article", 404);
  return source;
}
function scopedClaim(state, workspaceId, taskId, claimId) {
  const claim = (state.claims || []).find(item => item.id === claimId && item.workspaceId === workspaceId && item.taskId === taskId);
  if (!claim) fail("Claim not found in this workspace and article", 404);
  return claim;
}

export function assessSource(state, input) {
  const { workspaceId, taskId, sourceId } = input;
  taskFor(state, workspaceId, taskId);
  const source = scopedSource(state, workspaceId, taskId, sourceId);
  const metadata = {
    author: boundedText(input.author, "author", 2, 180),
    publisher: boundedText(input.publisher, "publisher", 2, 180),
    sourceType: input.sourceType || "unspecified",
    publishedAt: validDate(input.publishedAt, "publishedAt"),
    updatedAt: validDate(input.updatedAt, "updatedAt"),
    effectiveFrom: validDate(input.effectiveFrom, "effectiveFrom"),
    effectiveTo: validDate(input.effectiveTo, "effectiveTo"),
    jurisdiction: boundedText(input.jurisdiction, "jurisdiction", 2, 180),
    methodology: boundedText(input.methodology, "methodology", 5, 1200),
    qualityRating: input.qualityRating || "unassessed",
    qualityRationale: boundedText(input.qualityRationale, "qualityRationale", 8, 1200),
    assessmentNotes: boundedText(input.assessmentNotes, "assessmentNotes", 0, 2000),
    assessedAt: new Date().toISOString(),
    assessmentMode: "manual-editorial-review"
  };
  const sourceTypes = new Set(["primary", "official", "academic", "news", "industry", "opinion", "reference", "unspecified"]);
  const ratings = new Set(["high", "medium", "low", "unassessed"]);
  if (!sourceTypes.has(metadata.sourceType)) fail("Unsupported sourceType");
  if (!ratings.has(metadata.qualityRating)) fail("Unsupported qualityRating");
  if (metadata.qualityRating !== "unassessed" && metadata.qualityRationale.length < 8) fail("A rationale is required for a manual quality rating");
  if (metadata.effectiveFrom && metadata.effectiveTo && Date.parse(metadata.effectiveTo) < Date.parse(metadata.effectiveFrom)) fail("effectiveTo cannot precede effectiveFrom");
  const completenessFields = ["author", "publisher", "sourceType", "publishedAt", "updatedAt", "jurisdiction", "methodology"];
  const completed = completenessFields.filter(key => Boolean(metadata[key])).length;
  source.research = { ...metadata, metadataCompleteness: Math.round(completed / completenessFields.length * 100) };
  return source;
}

export function recordEvidence(state, input) {
  const { workspaceId, taskId, sourceId, claimId } = input;
  taskFor(state, workspaceId, taskId);
  scopedSource(state, workspaceId, taskId, sourceId);
  scopedClaim(state, workspaceId, taskId, claimId);
  const excerpt = boundedText(input.excerpt, "excerpt", 5, 4000, true);
  const locator = boundedText(input.locator, "locator", 0, 500);
  const note = boundedText(input.note, "note", 0, 1200);
  const stance = input.stance || "unclear";
  if (!new Set(["supports", "contradicts", "contextualizes", "unclear"]).has(stance)) fail("Unsupported evidence stance");
  const evidence = {
    id: randomUUID(), workspaceId, taskId, sourceId, claimId, excerpt, locator, note, stance,
    observedAt: validDate(input.observedAt, "observedAt") || new Date().toISOString(),
    recordedAt: new Date().toISOString(),
    verificationState: "manually-transcribed-unverified"
  };
  state.researchEvidence ||= [];
  state.researchEvidence.push(evidence);
  return evidence;
}

export function listResearch(state, workspaceId, taskId) {
  taskFor(state, workspaceId, taskId);
  const sources = (state.sources || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const claims = (state.claims || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const evidence = (state.researchEvidence || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const claimResearch = claims.map(claim => {
    const records = evidence.filter(item => item.claimId === claim.id);
    const hasSupport = records.some(item => item.stance === "supports");
    const hasContradiction = records.some(item => item.stance === "contradicts");
    return {
      claimId: claim.id,
      text: claim.text,
      evidenceCount: records.length,
      sourceIds: [...new Set(records.map(item => item.sourceId))],
      conflictState: hasSupport && hasContradiction ? "conflicting-evidence" : hasContradiction ? "contradicting-evidence-recorded" : hasSupport ? "supporting-evidence-recorded" : "no-evidence-recorded",
      evidence: records
    };
  });
  return {
    sources: sources.map(source => ({
      id: source.id, url: source.url, title: source.title || "",
      fetched: Boolean(source.fetched), research: source.research || null
    })),
    claims: claimResearch,
    summary: {
      sourceCount: sources.length,
      assessedSourceCount: sources.filter(source => source.research).length,
      claimCount: claims.length,
      evidenceRecordCount: evidence.length,
      claimsWithConflictingEvidence: claimResearch.filter(item => item.conflictState === "conflicting-evidence").length,
      claimsWithoutEvidence: claimResearch.filter(item => item.evidenceCount === 0).length,
      note: "Assessments and excerpts are manually entered. Evidence stance is an editorial annotation, not independent verification."
    }
  };
}
