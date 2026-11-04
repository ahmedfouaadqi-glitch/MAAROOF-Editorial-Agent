import { randomUUID } from "node:crypto";
import { reserveBudget } from "./research-budget.mjs";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function runResearchInspection({ store, workspaceId, taskId, sourceId, operationId }) {
  const snapshot = await store.read();
  const task = snapshot.tasks?.[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) fail("Editorial task not found", 404);
  const source = (snapshot.sources || []).find(item =>
    item.id === sourceId && item.workspaceId === workspaceId && item.taskId === taskId
  );
  if (!source) fail("Source not found in this workspace and article", 404);
  if (!source.fetched || typeof source.contentMarkdown !== "string" || !source.contentMarkdown.trim()) {
    fail("Only a source fetched by the research crawler can be inspected", 409);
  }

  const reservationId = typeof operationId === "string" && operationId.length >= 8 && operationId.length <= 128
    ? "inspect-" + operationId
    : "inspect-" + randomUUID();

  const prior = (snapshot.researchInspections || []).find(item =>
    item.workspaceId === workspaceId && item.taskId === taskId && item.reservationId === reservationId
  );
  if (prior) return { allowed: true, replayed: true, result: prior };

  const quota = await store.transact(state => reserveBudget(state, {
    workspaceId, taskId, operation: "inspect", units: 1, reservationId
  }));
  if (!quota.allowed) return { allowed: false, quota };

  const markdown = source.contentMarkdown;
  const words = markdown.trim().split(/\s+/).filter(Boolean);
  const headings = markdown.match(/^#{1,6}\s+.+$/gm) || [];
  const links = [...markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)].map(match => match[1]);
  const issues = [];
  if (!source.title?.trim()) issues.push("missing-title");
  if (words.length < 120) issues.push("short-extracted-content");
  if (headings.length === 0) issues.push("no-detected-headings");
  if (links.length === 0) issues.push("no-detected-inline-links");

  const result = await store.transact(state => {
    state.researchInspections ||= [];
    const current = (state.sources || []).find(item =>
      item.id === sourceId && item.workspaceId === workspaceId && item.taskId === taskId
    );
    if (!current || current.contentMarkdown !== markdown) fail("Source changed during inspection; retry with a new operation ID", 409);
    const record = {
      id: randomUUID(), workspaceId, taskId, sourceId, reservationId,
      inspectedAt: new Date().toISOString(),
      metrics: { wordCount: words.length, headingCount: headings.length, inlineLinkCount: links.length },
      issues,
      verificationState: "structure-inspection-only",
      limitations: [
        "This deterministic inspection evaluates extracted structure, not factual accuracy.",
        "It does not determine source credibility, relevance, or whether claims are true."
      ]
    };
    state.researchInspections.push(record);
    return record;
  });
  return { allowed: true, replayed: false, result, quota: { ...quota, usage: undefined } };
}
