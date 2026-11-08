import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME, createEditorialWorkspace,
  ensureDefaultWorkspaceCollection, listEditorialWorkspaces
} from "./editorial-workspaces.mjs";

describe("editorial workspaces", () => {
  it("migrates a legacy store to a default workspace without replacing existing data", () => {
    const state = { tasks: { retained: { id: "retained" } } } as Record<string, any>;
    expect(ensureDefaultWorkspaceCollection(state, "2026-01-01T00:00:00.000Z")).toBe(true);
    expect(state.workspaces).toEqual([{
      id: DEFAULT_WORKSPACE_ID, name: DEFAULT_WORKSPACE_NAME,
      nameAr: DEFAULT_WORKSPACE_NAME, nameEn: "Main workspace",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
    }]);
    expect(state.tasks.retained).toBeTruthy();
  });

  it("creates a normalized workspace and lists it alongside the default", () => {
    const state: Record<string, any> = { workspaces: [] };
    const created = createEditorialWorkspace(state, { name: "  Brand   Studio  " });
    expect(created.id).toMatch(/^ws-[0-9a-f-]{36}$/i);
    expect(created.name).toBe("Brand Studio");
    expect(listEditorialWorkspaces(state).map(item => item.id)).toEqual([DEFAULT_WORKSPACE_ID, created.id]);
    expect(listEditorialWorkspaces(state, "en")[0].name).toBe("Main workspace");
  });

  it("rejects duplicate names after Unicode and whitespace normalization", () => {
    const state: Record<string, any> = { workspaces: [] };
    createEditorialWorkspace(state, { name: "Brand Studio" });
    expect(() => createEditorialWorkspace(state, { name: " brand   studio " })).toThrow(/already exists/i);
  });

  it.each(["", "x", "x".repeat(81), "bad\u0001name"]) ("rejects an invalid workspace name", name => {
    expect(() => createEditorialWorkspace({ workspaces: [] }, { name })).toThrow();
  });
});
