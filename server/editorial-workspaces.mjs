import { randomUUID } from "node:crypto";

export const DEFAULT_WORKSPACE_ID = "main-workspace";
export const DEFAULT_WORKSPACE_NAME = "مساحة العمل الرئيسية";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function cleanWorkspaceName(value) {
  if (typeof value !== "string") fail("Workspace name must be text");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) fail("Workspace name must contain 2-80 characters");
  if (/[\u0000-\u001f\u007f]/.test(name)) fail("Workspace name contains unsupported characters");
  return name;
}

export function ensureDefaultWorkspaceCollection(state, now = new Date().toISOString()) {
  let changed = false;
  if (!Array.isArray(state.workspaces)) {
    state.workspaces = [];
    changed = true;
  }
  const existing = state.workspaces.find(item => item?.id === DEFAULT_WORKSPACE_ID);
  if (!existing) {
    state.workspaces.unshift({ id: DEFAULT_WORKSPACE_ID, name: DEFAULT_WORKSPACE_NAME, nameAr: DEFAULT_WORKSPACE_NAME, nameEn: "Main workspace", createdAt: now, updatedAt: now });
    changed = true;
  } else {
    if (typeof existing.name !== "string" || !existing.name.trim()) {
      existing.name = DEFAULT_WORKSPACE_NAME;
      changed = true;
    }
    if (!existing.nameAr) { existing.nameAr = existing.name; changed = true; }
    if (!existing.nameEn) { existing.nameEn = "Main workspace"; changed = true; }
    if (!existing.createdAt) { existing.createdAt = now; changed = true; }
    if (!existing.updatedAt) { existing.updatedAt = existing.createdAt; changed = true; }
  }
  return changed;
}

export function listEditorialWorkspaces(state, locale = "ar") {
  ensureDefaultWorkspaceCollection(state);
  return state.workspaces
    .filter(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.createdAt === "string")
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(item => ({
      id: item.id,
      name: item.id === DEFAULT_WORKSPACE_ID ? (locale === "en" ? item.nameEn : item.nameAr) : item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
}

export function createEditorialWorkspace(state, { name }) {
  const cleanName = cleanWorkspaceName(name);
  ensureDefaultWorkspaceCollection(state);
  const normalized = cleanName.toLocaleLowerCase();
  if (state.workspaces.some(item => typeof item?.name === "string" && item.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() === normalized)) {
    fail("A workspace with this name already exists", 409);
  }
  const now = new Date().toISOString();
  const workspace = { id: `ws-${randomUUID()}`, name: cleanName, nameAr: cleanName, nameEn: cleanName, createdAt: now, updatedAt: now };
  state.workspaces.push(workspace);
  return structuredClone(workspace);
}
