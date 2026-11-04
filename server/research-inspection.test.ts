import { describe, expect, it } from "vitest";
import { runResearchInspection } from "./research-inspection.mjs";
import { DEFAULT_LIMITS } from "./research-budget.mjs";

function makeStore() {
  const state = {
    version: 1, limits: { ...DEFAULT_LIMITS },
    tasks: { "article-a": { workspaceId: "workspace-a", article: { id: "article-a" }, usage: {}, reservations: {} } },
    sources: [{
      id: "source-a", workspaceId: "workspace-a", taskId: "article-a",
      title: "Source A", fetched: true,
      contentMarkdown: "# Heading\n\n" + "Evidence text ".repeat(70) + "\n\n[Reference](https://example.org/ref)"
    }],
    researchInspections: []
  };
  return { state, read: async () => structuredClone(state), transact: async mutator => mutator(state) };
}
const scope = { workspaceId: "workspace-a", taskId: "article-a", sourceId: "source-a" };

describe("research source inspection", () => {
  it("fails for sources that were not fetched", async () => {
    const store = makeStore();
    store.state.sources[0].fetched = false;
    await expect(runResearchInspection({ store, ...scope })).rejects.toMatchObject({ status: 409 });
  });

  it("records structure metrics without claiming factual verification", async () => {
    const store = makeStore();
    const result = await runResearchInspection({ store, ...scope, operationId: "inspection-0001" });
    expect(result.result.metrics.wordCount).toBeGreaterThan(120);
    expect(result.result.metrics.headingCount).toBe(1);
    expect(result.result.verificationState).toBe("structure-inspection-only");
    expect(store.state.tasks["article-a"].usage.inspect).toBe(1);
  });

  it("enforces inspection limits", async () => {
    const store = makeStore();
    store.state.limits.inspectionsPerArticle = 1;
    store.state.tasks["article-a"].usage.inspect = 1;
    const result = await runResearchInspection({ store, ...scope, operationId: "inspection-0002" });
    expect(result.allowed).toBe(false);
  });

  it("prevents cross-workspace source inspection", async () => {
    const store = makeStore();
    await expect(runResearchInspection({ store, ...scope, workspaceId: "workspace-b" })).rejects.toMatchObject({ status: 404 });
  });

  it("replays an existing inspection without consuming another unit", async () => {
    const store = makeStore();
    store.state.researchInspections.push({ workspaceId: scope.workspaceId, taskId: scope.taskId, reservationId: "inspect-repeat-01", verificationState: "structure-inspection-only" });
    const result = await runResearchInspection({ store, ...scope, operationId: "repeat-01" });
    expect(result.replayed).toBe(true);
    expect(store.state.tasks["article-a"].usage.inspect || 0).toBe(0);
  });
});
