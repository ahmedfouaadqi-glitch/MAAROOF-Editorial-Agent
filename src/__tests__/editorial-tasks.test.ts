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

  it("binds article tasks to normalized workspace client and brand records", () => {
    const state: any = { tasks: {}, clients: [], brands: [] };
    const first = createEditorialTask(state, { workspaceId: "workspace-1", topic: "First client article", clientName: "Acme Group", brandName: "Acme Daily" });
    const second = createEditorialTask(state, { workspaceId: "workspace-1", topic: "Second client article", clientName: "ACME GROUP", brandName: "ACME DAILY" });
    expect(first.article.clientId).toBe(second.article.clientId);
    expect(first.article.brandId).toBe(second.article.brandId);
    expect(first.article).toMatchObject({ clientName: "Acme Group", brandName: "Acme Daily" });
    expect(listEditorialTasks(state, "workspace-1").find(item=>item.id===second.id)?.clientName).toBe("Acme Group");
  });

  it("validates language, objective and topic", () => {
    const state = { tasks: {} };
    expect(() => createEditorialTask(state, { workspaceId: "w", topic: "ok", language: "fr" as never })).toThrow();
    expect(() => createEditorialTask(state, { workspaceId: "w", topic: "valid topic", objective: "spam" as never })).toThrow();
  });

  it("enforces the editorial sequence and workspace ownership", () => {
    const state = { tasks: {} };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-2", taskId: task.id, nextStage: "planning" })).toThrow("Editorial task not found");
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "drafting" })).toThrow("Invalid editorial transition");
    expect(advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "planning" }).stage).toBe("planning");
  });
  it("blocks drafting until an outline exists", () => {
    const state = { tasks: {} as Record<string, any> };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    task.article.stage = "outline";
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "drafting" }))
      .toThrow("Create the editorial outline before drafting");
  });

  it("blocks source review until the full draft metadata and at least one source are present", () => {
    const state = {
      tasks: {} as Record<string, any>,
      editorialDrafts: [{ workspaceId: "workspace-1", taskId: "task-id", title: "Title", metaTitle: "Meta", metaDescription: "Description", sections: [{ heading: "One", body: "Too short" }, { heading: "Two", body: "Too short" }] }],
      sources: []
    };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    state.editorialDrafts[0].taskId = task.id;
    task.article.stage = "drafting";
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "source-review" }))
      .toThrow("Complete the article draft and register source references");
  });

  it("blocks publication readiness without a current human editorial approval", () => {
    const state = { tasks: {} as Record<string, any>, editorialDrafts: [], sources: [], claims: [], researchEvidence: [], originalityChecks: [], editorialReviews: [] };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    task.article.stage = "editorial-approval";
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "ready-to-publish" }))
      .toThrow("current human approval");
  });

});
