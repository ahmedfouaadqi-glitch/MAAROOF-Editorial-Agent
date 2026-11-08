import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../../server/store.mjs";
import { DEFAULT_LIMITS, reserveBudget } from "../../server/research-budget.mjs";
import { DEFAULT_WORKSPACE_ID } from "../../server/editorial-workspaces.mjs";

describe("JSON store persistence and concurrency", () => {
  it("creates a default workspace on a fresh store", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maaroof-editorial-"));
    const file = join(dir, "state.json");
    try {
      const store = new JsonStore(file);
      await store.init();
      const persisted = JSON.parse(await readFile(file, "utf8"));
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
      const persisted = JSON.parse(await readFile(file, "utf8"));
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
        store.transact(state => reserveBudget(state, {
          workspaceId: "workspace-1",
          taskId: "article-1",
          operation: "search",
          reservationId: `search-reservation-${i}`
        }))
      ));
      expect(attempts.filter(result => result.allowed)).toHaveLength(DEFAULT_LIMITS.searchesPerArticle);
      const restartedStore = new JsonStore(file);
      expect((await restartedStore.read()).tasks["article-1"].usage.search).toBe(5);
      const persisted = JSON.parse(await readFile(file, "utf8"));
      expect(persisted.tasks["article-1"].usage.search).toBe(5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
