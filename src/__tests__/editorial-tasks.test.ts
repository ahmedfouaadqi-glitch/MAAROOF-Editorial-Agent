import { describe, expect, it } from "vitest";
import { createEditorialTask, listEditorialTasks, advanceEditorialTask } from "../../server/editorial-tasks.mjs";

type TaskFixture = { id: string; workspaceId: string; usage: { source: number; search: number; inspect: number }; article: { topic: string; stage?: string; clientId?: string; brandId?: string; clientName?: string; brandName?: string; [key: string]: string | number | undefined } };
type EditorialDraftFixture = { workspaceId: string; taskId: string; title: string; metaTitle: string; metaDescription: string; sections: { heading: string; body: string }[] };
type TestState = { tasks: Record<string, TaskFixture>; clients?: unknown[]; brands?: unknown[]; editorialDrafts?: EditorialDraftFixture[]; sources?: unknown[]; claims?: unknown[]; researchEvidence?: unknown[]; originalityChecks?: unknown[]; editorialReviews?: unknown[] };
function assertTask(value: unknown): asserts value is TaskFixture {
  if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string" || !("workspaceId" in value) || typeof value.workspaceId !== "string" || !("article" in value) || typeof value.article !== "object" || value.article === null || !("topic" in value.article) || typeof value.article.topic !== "string" || !("usage" in value) || typeof value.usage !== "object" || value.usage === null) throw new Error("Expected an editorial task fixture");
}
function assertTaskSummary(value: unknown): asserts value is { id: string; clientName?: string } {
  if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string" || ("clientName" in value && typeof value.clientName !== "string")) throw new Error("Expected an editorial task summary");
}
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
    assertTask(task);
    expect(task.article.stage).toBe("intake");
    expect(task.usage).toEqual({ source: 0, search: 0, inspect: 0 });
    expect(listEditorialTasks(state, "workspace-1")).toHaveLength(1);
    expect(listEditorialTasks(state, "workspace-2")).toHaveLength(0);
  });
  it("binds article tasks to normalized workspace client and brand records", () => {
    const state: TestState = { tasks: {}, clients: [], brands: [] };
    const first = createEditorialTask(state, { workspaceId: "workspace-1", topic: "First client article", clientName: "Acme Group", brandName: "Acme Daily" });
    const second = createEditorialTask(state, { workspaceId: "workspace-1", topic: "Second client article", clientName: "ACME GROUP", brandName: "ACME DAILY" });
    assertTask(first);
    assertTask(second);
    expect(first.article.clientId).toBe(second.article.clientId);
    expect(first.article.brandId).toBe(second.article.brandId);
    expect(first.article).toMatchObject({ clientName: "Acme Group", brandName: "Acme Daily" });
    const listed = listEditorialTasks(state, "workspace-1");
    const summaries = listed.map(item => {
      assertTaskSummary(item);
      return item;
    });
    expect(summaries.find(item=>item.id===second.id)?.clientName).toBe("Acme Group");
  });
  it("validates language, objective and topic", () => {
    const state = { tasks: {} };
    expect(() => createEditorialTask(state, { workspaceId: "w", topic: "ok", language: "fr" as never })).toThrow();
    expect(() => createEditorialTask(state, { workspaceId: "w", topic: "valid topic", objective: "spam" as never })).toThrow();
  });
  it("enforces the editorial sequence and workspace ownership", () => {
    const state = { tasks: {} };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    assertTask(task);
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-2", taskId: task.id, nextStage: "planning" })).toThrow("Editorial task not found");
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "drafting" })).toThrow("Invalid editorial transition");
    expect(advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "planning" })).toMatchObject({ stage: "planning" });
  });
  it("blocks drafting until an outline exists", () => {
    const state = { tasks: {} as Record<string, TaskFixture> };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    assertTask(task);
    task.article.stage = "outline";
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "drafting" }))
      .toThrow("Create the editorial outline before drafting");
  });
  it("blocks source review until the full draft metadata and at least one source are present", () => {
    const state = {
      tasks: {} as Record<string, TaskFixture>,
      editorialDrafts: [{ workspaceId: "workspace-1", taskId: "task-id", title: "Title", metaTitle: "Meta", metaDescription: "Description", sections: [{ heading: "One", body: "Too short" }, { heading: "Two", body: "Too short" }] }],
      sources: []
    };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    assertTask(task);
    state.editorialDrafts[0].taskId = task.id;
    task.article.stage = "drafting";
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "source-review" }))
      .toThrow("Complete the article draft and register source references");
  });
  it("blocks publication readiness without a current human editorial approval", () => {
    const state = { tasks: {} as Record<string, TaskFixture>, editorialDrafts: [], sources: [], claims: [], researchEvidence: [], originalityChecks: [], editorialReviews: [] };
    const task = createEditorialTask(state, { workspaceId: "workspace-1", topic: "A sufficiently detailed topic" });
    assertTask(task);
    task.article.stage = "editorial-approval";
    expect(() => advanceEditorialTask(state, { workspaceId: "workspace-1", taskId: task.id, nextStage: "ready-to-publish" }))
      .toThrow("current human approval");
  });
});
