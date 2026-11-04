import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../../server/store.mjs";
import { DEFAULT_LIMITS, reserveBudget } from "../../server/research-budget.mjs";

describe("JSON store persistence and concurrency", () => {
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
