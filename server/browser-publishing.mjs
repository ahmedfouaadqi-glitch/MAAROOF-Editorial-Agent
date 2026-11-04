import { randomUUID } from "node:crypto";
import { assertCurrentEditorialApproval, getEditorialApproval } from "./editorial-approval.mjs";
import { getEditorialDraft } from "./editorial-drafts.mjs";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function normalizeUrl(value, field) {
  let url;
  try { url = new URL(value); } catch { fail(`${field} must be a valid URL`); }
  if (url.protocol !== "https:" || url.username || url.password) fail(`${field} must be HTTPS and cannot contain credentials`);
  url.hash = "";
  return url;
}
function normalizeHosts(value, baseHosts) {
  if (!Array.isArray(value)) fail("approvedHosts must be an array");
  const hosts = [...new Set([...baseHosts, ...value.map(item => String(item).trim().toLowerCase())])];
  if (hosts.length < 1 || hosts.length > 12 || hosts.some(host =>
    !host || host.length > 253 || /[^a-z0-9.-]/.test(host) || host.startsWith(".") || host.endsWith(".") || host.includes("..")
  )) fail("approvedHosts must contain 1-12 valid DNS hostnames");
  return hosts;
}
function hostAllowed(host, hosts) {
  const value = host.toLowerCase();
  return hosts.some(item => value === item || value.endsWith("." + item));
}

export function registerBrowserDestination(state, { workspaceId, name, homepage, editorUrl, approvedHosts = [], titleSelector, bodySelector, imageUploadSelector = "", authorityConfirmed, policyReviewed }) {
  if (typeof workspaceId !== "string" || !workspaceId.trim() || workspaceId.length > 128) fail("workspaceId is required");
  if (authorityConfirmed !== true) fail("Confirm that you own or are authorized to use this destination");
  if (policyReviewed !== true) fail("Confirm that the destination's publishing policies have been reviewed");
  const displayName = clean(name, 120);
  if (displayName.length < 2) fail("Destination name must contain at least 2 characters");
  const home = normalizeUrl(homepage, "homepage");
  const editor = editorUrl ? normalizeUrl(editorUrl, "editorUrl") : home;
  const hosts = normalizeHosts(approvedHosts, [home.hostname.toLowerCase()]);
  if (!hostAllowed(editor.hostname, hosts)) fail("editorUrl host must be listed in approvedHosts");
  for (const selector of [titleSelector, bodySelector]) {
    if (typeof selector !== "string" || !selector.trim() || selector.length > 500) fail("Title and body selectors must be configured");
  }
  if (imageUploadSelector && (typeof imageUploadSelector !== "string" || imageUploadSelector.length > 500)) fail("imageUploadSelector is invalid");
  state.browserDestinations ||= [];
  const existing = state.browserDestinations.find(item => item.workspaceId === workspaceId && item.homepage === home.toString());
  const destination = {
    id: existing?.id || randomUUID(), workspaceId, name: displayName,
    homepage: home.toString(), editorUrl: editor.toString(), approvedHosts: hosts,
    selectors: { title: titleSelector.trim(), body: bodySelector.trim(), imageUpload: clean(imageUploadSelector, 500) },
    status: "operator-declared-unverified",
    automaticPublishEnabled: false,
    authorityConfirmed: true,
    policyReviewed: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    limitations: [
      "The destination and policy confirmations are user declarations; ownership and external capability are not independently verified.",
      "The system can fill the approved article text but does not automatically submit or publish it.",
      "The user must review the remote editor and perform any final submission personally."
    ]
  };
  if (existing) Object.assign(existing, destination);
  else state.browserDestinations.push(destination);
  return destination;
}

export function listBrowserDestinations(state, workspaceId) {
  return (state.browserDestinations || []).filter(item => item.workspaceId === workspaceId);
}
export function listBrowserSessions(state, workspaceId) {
  return (state.browserSessions || []).filter(item => item.workspaceId === workspaceId);
}
export function getBrowserDestination(state, workspaceId, destinationId) {
  const item = (state.browserDestinations || []).find(x => x.id === destinationId && x.workspaceId === workspaceId);
  if (!item) fail("Publishing destination not found in this workspace", 404);
  return item;
}
export function saveBrowserSession(state, session) {
  state.browserSessions ||= [];
  const record = {
    id: session.id, workspaceId: session.workspaceId, destinationId: session.destinationId,
    state: session.state, currentUrl: session.currentUrl, title: session.title,
    createdAt: session.createdAt, expiresAt: session.expiresAt, updatedAt: new Date().toISOString()
  };
  const index = state.browserSessions.findIndex(x => x.id === record.id && x.workspaceId === record.workspaceId);
  if (index >= 0) state.browserSessions[index] = record;
  else state.browserSessions.push(record);
  return record;
}
export function getBrowserSession(state, workspaceId, sessionId) {
  const session = (state.browserSessions || []).find(x => x.id === sessionId && x.workspaceId === workspaceId);
  if (!session) fail("Browser session not found in this workspace", 404);
  return session;
}
export function updateBrowserSession(state, workspaceId, sessionId, patch) {
  const session = getBrowserSession(state, workspaceId, sessionId);
  Object.assign(session, {
    state: patch.state || session.state,
    currentUrl: patch.currentUrl || session.currentUrl,
    title: patch.title ?? session.title,
    updatedAt: new Date().toISOString()
  });
  return session;
}
export function removeBrowserSession(state, workspaceId, sessionId) {
  const session = getBrowserSession(state, workspaceId, sessionId);
  state.browserSessions = (state.browserSessions || []).filter(x => x.id !== sessionId || x.workspaceId !== workspaceId);
  return { id: session.id, closed: true };
}

export function buildApprovedArticleForBrowser(state, { workspaceId, taskId, destination }) {
  if (!destination || destination.workspaceId !== workspaceId) fail("Publishing destination not found in this workspace", 404);
  const task = state.tasks?.[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) fail("Editorial task not found", 404);
  if (task.article.stage !== "ready-to-publish") fail("Article must reach ready-to-publish before browser transfer", 409);
  assertCurrentEditorialApproval(state, workspaceId, taskId);
  const approval = getEditorialApproval(state, workspaceId, taskId);
  if (!approval.approvedForCurrentDraft) fail("The current draft has no valid human editorial approval", 409);
  const draft = getEditorialDraft(state, workspaceId, taskId);
  if (!draft || !draft.title?.trim() || !draft.sections?.some(section => section.body?.trim())) fail("A complete article draft is required", 409);
  const body = draft.sections.map(section => [`## ${section.heading}`, section.body].filter(Boolean).join("\n\n")).join("\n\n");
  if (body.length > 200_000) fail("Article body exceeds the browser transfer limit", 413);
  return {
    title: draft.title.trim(),
    body: [draft.dek, body, draft.disclosure ? `Disclosure: ${draft.disclosure}` : ""].filter(Boolean).join("\n\n"),
    titleSelector: destination.selectors.title,
    bodySelector: destination.selectors.body,
    articleFingerprint: approval.draftFingerprint,
    sourceTaskId: taskId,
    publishingEnabled: false,
    requiresHumanSubmission: true
  };
}
