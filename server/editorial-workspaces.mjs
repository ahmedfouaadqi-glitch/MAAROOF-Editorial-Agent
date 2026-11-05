import { randomUUID } from "node:crypto";

const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function normalizeName(value) {
  if (typeof value !== "string") fail("Workspace name is required");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > MAX_NAME) fail("Workspace name must contain 2-100 characters");
  return name;
}
function normalizeDescription(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > MAX_DESCRIPTION) fail("Workspace description must be at most 500 characters");
  return value.trim();
}

export function ensureDefaultWorkspace(state) {
  state.workspaces ||= [];
  if (!state.workspaces.some(item => item.id === "main-workspace")) {
    state.workspaces.unshift({
      id: "main-workspace", name: "مساحة العمل الرئيسية", description: "",
      status: "active", isDefault: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }
  return state.workspaces;
}

export function listWorkspaces(state, { includeArchived = false } = {}) {
  const workspaces = ensureDefaultWorkspace(state);
  return workspaces.filter(item => includeArchived || item.status !== "archived")
    .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || a.name.localeCompare(b.name));
}

export function getWorkspace(state, workspaceId) {
  const workspace = ensureDefaultWorkspace(state).find(item => item.id === workspaceId);
  if (!workspace || workspace.status === "archived") fail("Workspace not found", 404);
  return workspace;
}

export function createWorkspace(state, input = {}) {
  const name = normalizeName(input.name);
  const description = normalizeDescription(input.description);
  ensureDefaultWorkspace(state);
  if (state.workspaces.some(item => item.status !== "archived" && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    fail("A workspace with this name already exists", 409);
  }
  const now = new Date().toISOString();
  const workspace = { id: randomUUID(), name, description, status: "active", isDefault: false, createdAt: now, updatedAt: now };
  state.workspaces.push(workspace);
  return workspace;
}

export function restoreWorkspace(state, workspaceId) {
  const workspace = ensureDefaultWorkspace(state).find(item => item.id === workspaceId);
  if (!workspace) fail("Workspace not found", 404);
  if (workspace.isDefault) return workspace;
  if (workspace.status !== "archived") return workspace;
  workspace.status = "active";
  workspace.updatedAt = new Date().toISOString();
  return workspace;
}

export function updateWorkspace(state, workspaceId, input = {}) {
  const workspace = getWorkspace(state, workspaceId);
  if (workspace.isDefault && input.status === "archived") fail("The default workspace cannot be archived");
  if (input.name !== undefined) {
    const name = normalizeName(input.name);
    if (state.workspaces.some(item => item.id !== workspaceId && item.status !== "archived" && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      fail("A workspace with this name already exists", 409);
    }
    workspace.name = name;
  }
  if (input.description !== undefined) workspace.description = normalizeDescription(input.description);
  if (input.status !== undefined) {
    if (!["active", "archived"].includes(input.status)) fail("Invalid workspace status");
    if (workspace.isDefault && input.status !== "active") fail("The default workspace cannot be archived");
    workspace.status = input.status;
  }
  workspace.updatedAt = new Date().toISOString();
  return workspace;
}
