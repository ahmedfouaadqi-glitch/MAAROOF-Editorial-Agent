import { describe, expect, it } from "vitest";
import { createEditorialTask, listEditorialTasks, advanceEditorialTask } from "../../server/editorial-tasks.mjs";

describe("editorial task lifecycle", () => {
  it("creates an intake task scoped to a workspace", () => {
    const state = { tasks: {} };
    const task = createEditorialTask(state, {
      workspaceId: "workspace-1",
      topic: "تأثير البحث التوليدي على العلامات التجارية",
      language: "ar",
      objective: "analysis",
      targetPlatformId: "wordpress"
    });
    expect(task.article.stage).toBe("intake");
    expect(task.usage).toEqual({ source: 0, search: 0, inspect: 0 });
    expect(listEditorialTasks(state, "workspace-1")).toHaveLength(1);
    expect(listEditorialTasks(state, "workspace-2")).toHaveLength(0);
  });

  it("validates language, objective and topic", () => {
    const state = { tasks: {} };
    expect(() => createEditorialTask(state, { workspaceId: "w", topic: "ok", language: "fr" })).toThrow();
    expect(() => createEditorialTask(state, { workspaceId: "w", topic: "valid topic", objective: "spam" })).toThrow();
  });

  it("enforces the editorial sequence and workspace ownership", () => {
    const state = { tasks: {} };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-2", taskId: task.id, nextStage: "planning" })).toThrow("Editorial task not found");
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "drafting" })).toThrow("Invalid editorial transition");
    expect(advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "planning" }).stage).toBe("planning");
  });
});
