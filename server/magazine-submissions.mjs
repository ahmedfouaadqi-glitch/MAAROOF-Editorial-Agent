import { randomUUID } from "node:crypto";

const STATUSES = new Set(["draft", "approved", "submitted", "editor-replied", "accepted", "rejected", "published", "withdrawn"]);
const TRANSITIONS = {
  draft: new Set(["approved", "withdrawn"]),
  approved: new Set(["draft", "submitted", "withdrawn"]),
  submitted: new Set(["editor-replied", "accepted", "rejected", "withdrawn"]),
  "editor-replied": new Set(["submitted", "accepted", "rejected", "withdrawn"]),
  accepted: new Set(["published", "withdrawn"]),
  rejected: new Set([]),
  published: new Set([]),
  withdrawn: new Set([])
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function requiredText(value, field, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${field} must contain 1-${max} characters`);
  return value.trim();
}

function taskFor(state, workspaceId, taskId) {
  const task = state.tasks?.[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) fail("Editorial task not found", 404);
  return task;
}

export function createMagazineSubmission(state, input) {
  const { workspaceId, taskId } = input;
  if (typeof workspaceId !== "string" || !workspaceId.trim() || workspaceId.length > 128) fail("workspaceId is required");
  if (typeof taskId !== "string" || !taskId.trim() || taskId.length > 128) fail("taskId is required");
  taskFor(state, workspaceId, taskId);
  const publicationId = requiredText(input.publicationId, "publicationId", 120);
  const pitch = requiredText(input.pitch, "pitch", 12000);
  const proposedTitle = requiredText(input.proposedTitle, "proposedTitle", 300);
  const submission = {
    id: randomUUID(), workspaceId, taskId, publicationId, proposedTitle, pitch,
    authorName: typeof input.authorName === "string" ? input.authorName.trim().slice(0, 160) : "",
    exclusivityConfirmed: input.exclusivityConfirmed === true,
    status: "draft", history: [{ status: "draft", at: new Date().toISOString(), note: "Created locally; nothing was sent externally." }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  state.magazineSubmissions ||= [];
  state.magazineSubmissions.push(submission);
  return submission;
}

export function listMagazineSubmissions(state, workspaceId, taskId) {
  taskFor(state, workspaceId, taskId);
  return (state.magazineSubmissions || [])
    .filter(item => item.workspaceId === workspaceId && item.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function transitionMagazineSubmission(state, { workspaceId, taskId, submissionId, nextStatus, note = "" }) {
  taskFor(state, workspaceId, taskId);
  if (!STATUSES.has(nextStatus)) fail("Unsupported submission status");
  const submission = (state.magazineSubmissions || []).find(item =>
    item.id === submissionId && item.workspaceId === workspaceId && item.taskId === taskId
  );
  if (!submission) fail("Magazine submission not found", 404);
  if (!TRANSITIONS[submission.status]?.has(nextStatus)) fail(`Invalid submission transition: ${submission.status} -> ${nextStatus}`, 409);
  if (nextStatus === "submitted" && submission.status === "approved" && submission.exclusivityConfirmed !== true) {
    fail("Confirm the publication's exclusivity requirements before recording submission", 409);
  }
  if (nextStatus === "published" && submission.status !== "accepted") fail("Only an accepted submission can be marked published", 409);
  const cleanNote = typeof note === "string" ? note.trim().slice(0, 2000) : "";
  submission.status = nextStatus;
  submission.updatedAt = new Date().toISOString();
  submission.history.push({ status: nextStatus, at: submission.updatedAt, note: cleanNote });
  if (nextStatus === "submitted") submission.submittedAt = submission.updatedAt;
  if (nextStatus === "published") submission.publishedAt = submission.updatedAt;
  return submission;
}
