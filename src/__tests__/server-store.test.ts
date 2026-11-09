import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../../server/store.mjs";
import { DEFAULT_LIMITS, reserveBudget } from "../../server/research-budget.mjs";
import type { BudgetState } from "../../server/research-budget.mjs";
import { DEFAULT_WORKSPACE_ID } from "../../server/editorial-workspaces.mjs";
type StoredRecord = Record<string, unknown>;
function assertRecord(value: unknown): asserts value is StoredRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected a JSON object");
}
function assertBudgetState(value: unknown): asserts value is BudgetState {
  assertRecord(value);
  if (typeof value.limits !== "object" || value.limits === null || typeof value.tasks !== "object" || value.tasks === null || !Array.isArray(value.sources)) throw new Error("Expected a budget state");
}
describe("JSON store persistence and concurrency", () => {
  it("creates a default workspace on a fresh store", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maaroof-editorial-"));
    const file = join(dir, "state.json");
    try {
      const store = new JsonStore(file);
      await store.init();
      const persisted: unknown = JSON.parse(await readFile(file, "utf8"));
      assertRecord(persisted);
      if (!Array.isArray(persisted.workspaces)) throw new Error("Expected persisted workspaces");
      assertRecord(persisted.workspaces[0]);
      expect(persisted.workspaces).toHaveLength(1);
      expect(persisted.workspaces[0].id).toBe(DEFAULT_WORKSPACE_ID);
      expect(typeof persisted.workspaces[0].createdAt).toBe("string");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("migrates a legacy store without losing task data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maaroof-editorial-"));
    const file = join(dir, "state.json");
    try {
      await writeFile(file, JSON.stringify({ version: 1, tasks: { legacy: { id: "legacy" } }, sources: [] }));
      const store = new JsonStore(file);
      await store.init();
      const persisted: unknown = JSON.parse(await readFile(file, "utf8"));
      assertRecord(persisted);
      assertRecord(persisted.tasks);
      assertRecord(persisted.tasks.legacy);
      if (!Array.isArray(persisted.workspaces)) throw new Error("Expected migrated workspaces");
      assertRecord(persisted.workspaces[0]);
      expect(persisted.tasks.legacy.id).toBe("legacy");
      expect(persisted.workspaces[0].id).toBe(DEFAULT_WORKSPACE_ID);
      expect(Array.isArray(persisted.editorialConversations)).toBe(true);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("serializes concurrent reservations and persists them across store instances", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maaroof-editorial-"));
    const file = join(dir, "state.json");
    try {
      const store = new JsonStore(file);
      await store.init();
      const attempts = await Promise.all(Array.from({ length: 9 }, (_, i) =>
        store.transact(state => {
          assertBudgetState(state);
          return reserveBudget(state, {
            workspaceId: "workspace-1",
            taskId: "article-1",
            operation: "search",
            reservationId: `search-reservation-${i}`
          });
        })
      ));
      expect(attempts.filter(result => result.allowed)).toHaveLength(DEFAULT_LIMITS.searchesPerArticle);
      const restartedStore = new JsonStore(file);
      const restartedState: unknown = await restartedStore.read();
      assertBudgetState(restartedState);
      expect(restartedState.tasks["article-1"].usage.search).toBe(5);
      const persisted: unknown = JSON.parse(await readFile(file, "utf8"));
      assertRecord(persisted);
      assertRecord(persisted.tasks);
      assertRecord(persisted.tasks["article-1"]);
      assertRecord(persisted.tasks["article-1"].usage);
      expect(persisted.tasks["article-1"].usage.search).toBe(5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
