import { randomUUID } from "node:crypto";
import { editorialDraftFingerprint, assertCurrentEditorialApproval } from "./editorial-approval.mjs";
import { assertCurrentMediaReview } from "./editorial-media.mjs";

const OBJECTIVES = new Set(["thought-leadership", "news", "analysis", "educational", "research-summary"]);
const LANGUAGES = new Set(["ar", "en"]);
const NEXT_STAGE = {
  intake: "planning",
  planning: "research",
  research: "entity-analysis",
  "entity-analysis": "outline",
  outline: "drafting",
  drafting: "source-review",
  "source-review": "originality-review",
  "originality-review": "media-review",
  "media-review": "editorial-approval",
  "editorial-approval": "ready-to-publish"
};

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function createEditorialTask(state, { workspaceId, topic, language = "ar", objective = "analysis", targetPlatformId, clientId, brandId }) {
  if (typeof workspaceId !== "string" || !workspaceId.trim() || workspaceId.length > 128) throw invalid("workspaceId is required");
  if (typeof topic !== "string" || topic.trim().length < 3 || topic.length > 500) throw invalid("topic must contain 3-500 characters");
  if (!LANGUAGES.has(language)) throw invalid("language must be ar or en");
  if (!OBJECTIVES.has(objective)) throw invalid("Unsupported editorial objective");

  const id = randomUUID();
  const now = new Date().toISOString();
  const task = {
    id,
    workspaceId,
    usage: { source: 0, search: 0, inspect: 0 },
    reservations: {},
    article: {
      topic: topic.trim(),
      language,
      objective,
      ...(typeof targetPlatformId === "string" && targetPlatformId.trim() ? { targetPlatformId: targetPlatformId.trim() } : {}),
      ...(typeof clientId === "string" && clientId.trim() ? { clientId: clientId.trim() } : {}),
      ...(typeof brandId === "string" && brandId.trim() ? { brandId: brandId.trim() } : {}),
      stage: "intake",
      createdAt: now,
      updatedAt: now
    },
    createdAt: now
  };
  state.tasks[id] = task;
  return task;
}

export function listEditorialTasks(state, workspaceId) {
  return Object.entries(state.tasks)
    .filter(([, task]) => task.workspaceId === workspaceId && task.article)
    .map(([id, task]) => ({ id, workspaceId: task.workspaceId, ...task.article }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function advanceEditorialTask(state, { workspaceId, taskId, nextStage }) {
  const task = state.tasks[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) {
    const error = new Error("Editorial task not found");
    error.status = 404;
    throw error;
  }
  const expected = NEXT_STAGE[task.article.stage];
  if (!expected || nextStage !== expected) {
    const error = new Error(`Invalid editorial transition: ${task.article.stage} -> ${nextStage}`);
    error.status = 409;
    throw error;
  }

  const draft = (state.editorialDrafts || []).find(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const sources = (state.sources || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const claims = (state.claims || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
  const evidence = (state.researchEvidence || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);

  function blocked(message, details = []) {
    const error = new Error(message);
    error.status = 409;
    error.details = details;
    throw error;
  }

  if (nextStage === "drafting") {
    if (!draft) blocked("Create the editorial outline before drafting", ["draft-missing"]);
    if (!Array.isArray(draft.sections) || draft.sections.length < 2 || draft.sections.some(section => !section.heading?.trim())) {
      blocked("The outline needs at least two titled sections", ["outline-incomplete"]);
    }
  }

  if (nextStage === "source-review") {
    const issues = [];
    if (!draft?.title?.trim()) issues.push("title-missing");
    if (!draft?.metaTitle?.trim()) issues.push("meta-title-missing");
    if (!draft?.metaDescription?.trim()) issues.push("meta-description-missing");
    if (!draft?.sections || draft.sections.length < 2 || draft.sections.some(section => !section.body?.trim() || section.body.trim().length < 20)) {
      issues.push("article-sections-incomplete");
    }
    if (sources.length === 0) issues.push("source-missing");
    if (issues.length) blocked("Complete the article draft and register source references before source review", issues);
  }

  if (nextStage === "originality-review") {
    const issues = [];
    if (claims.length === 0) issues.push("claims-missing");
    for (const claim of claims) {
      if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) issues.push("claim-source-unlinked:" + claim.id);
      if (!evidence.some(item => item.claimId === claim.id)) issues.push("claim-evidence-missing:" + claim.id);
    }
    for (const source of sources) {
      if (!source.research) issues.push("source-assessment-missing:" + source.id);
    }
    if (issues.length) blocked("Every factual claim needs linked, manually reviewed evidence and each source needs an assessment", issues);
  }

  if (nextStage === "media-review") {
    if (!draft) blocked("Editorial draft is missing", ["draft-missing"]);
    const fingerprint = editorialDraftFingerprint(draft);
    const checked = (state.originalityChecks || []).some(item =>
      item.workspaceId === workspaceId && item.taskId === taskId && item.fingerprint === fingerprint
    );
    if (!checked) blocked("Run the local originality check on the current draft version before media review", ["current-draft-originality-check-missing"]);
  }

  if (nextStage === "editorial-approval") {
    assertCurrentMediaReview(state, workspaceId, taskId);
  }

  if (nextStage === "ready-to-publish") {
    assertCurrentEditorialApproval(state, workspaceId, taskId);
  }

  task.article.stage = nextStage;
  task.article.updatedAt = new Date().toISOString();
  return { id: taskId, ...task.article };
}
