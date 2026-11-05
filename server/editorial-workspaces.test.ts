import { describe, expect, it } from "vitest";
import { createWorkspace, ensureDefaultWorkspace, getWorkspace, listWorkspaces, updateWorkspace } from "./editorial-workspaces.mjs";

describe("editorial workspaces", () => {
  it("seeds and lists a stable default workspace", () => {
    const state = {};
    const first = listWorkspaces(state);
    expect(first).toHaveLength(1);
    expect(first[0].id).toBe("main-workspace");
    expect(ensureDefaultWorkspace(state)).toHaveLength(1);
  });

  it("creates and retrieves independent workspaces", () => {
    const state = {};
    const created = createWorkspace(state, { name: "Client Alpha", description: "Editorial context" });
    expect(getWorkspace(state, created.id).name).toBe("Client Alpha");
    expect(listWorkspaces(state)).toHaveLength(2);
  });

  it("rejects duplicate names case-insensitively", () => {
    const state = {};
    createWorkspace(state, { name: "Brand Workspace" });
    expect(() => createWorkspace(state, { name: "brand workspace" })).toThrow(/already exists/);
  });

  it("updates and archives non-default workspaces", () => {
    const state = {};
    const created = createWorkspace(state, { name: "Temporary" });
    updateWorkspace(state, created.id, { name: "Renamed", description: "Updated" });
    expect(getWorkspace(state, created.id).name).toBe("Renamed");
    updateWorkspace(state, created.id, { status: "archived" });
    expect(listWorkspaces(state)).toHaveLength(1);
    expect(() => getWorkspace(state, created.id)).toThrow(/not found/);
  });

  it("does not allow archiving the default workspace", () => {
    const state = {};
    expect(() => updateWorkspace(state, "main-workspace", { status: "archived" })).toThrow(/default workspace/);
  });

  it("validates names and descriptions", () => {
    const state = {};
    expect(() => createWorkspace(state, { name: "x" })).toThrow(/2-100/);
    expect(() => createWorkspace(state, { name: "Valid", description: "x".repeat(501) })).toThrow(/500/);
  });
});
