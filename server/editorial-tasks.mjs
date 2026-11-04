import { randomUUID } from "node:crypto";

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
  task.article.stage = nextStage;
  task.article.updatedAt = new Date().toISOString();
  return { id: taskId, ...task.article };
}
