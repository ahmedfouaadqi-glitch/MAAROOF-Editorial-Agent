import { describe, expect, it, vi } from "vitest";
import { runMeteredResearchScrape } from "./research-scrape-service.mjs";
import { DEFAULT_LIMITS } from "./research-budget.mjs";

function makeStore() {
  const state = {
    version: 1, limits: { ...DEFAULT_LIMITS },
    tasks: { "article-a": { workspaceId: "workspace-a", article: { id: "article-a" }, usage: { source: 0, scrape: 0, search: 0, inspect: 0 }, reservations: {} } },
    sources: [], researchSearches: [], researchScrapes: []
  };
  return {
    state,
    read: async () => structuredClone(state),
    transact: async mutator => mutator(state)
  };
}
const scope = { workspaceId: "workspace-a", taskId: "article-a" };

describe("metered article scraping", () => {
  it("fails closed when Firecrawl is not configured", async () => {
    await expect(runMeteredResearchScrape({ store: makeStore(), provider: null, ...scope, input: { url: "https://example.org" } }))
      .rejects.toMatchObject({ status: 503 });
  });

  it("stores scraped content as unverified article evidence and charges one scrape", async () => {
    const store = makeStore();
    const provider = { scrape: vi.fn().mockResolvedValue({
      url: "https://example.org/article", title: "Article", markdown: "# Article body",
      retrievedAt: "2026-11-04T00:00:00.000Z", provider: "firecrawl-v2",
      verificationState: "scraped-content-unverified", limitations: []
    }) };
    const result = await runMeteredResearchScrape({ store, provider, ...scope, input: { url: "https://example.org/article" } });
    expect(result.allowed).toBe(true);
    expect(store.state.tasks["article-a"].usage.scrape).toBe(1);
    expect(store.state.sources[0]).toMatchObject({ fetched: true, verificationState: "scraped-content-unverified", contentMarkdown: "# Article body" });
    expect(result.result.sourceId).toBe(store.state.sources[0].id);
  });

  it("enforces the scrape quota before another provider call", async () => {
    const store = makeStore();
    store.state.limits.scrapesPerArticle = 1;
    store.state.tasks["article-a"].usage.scrape = 1;
    const provider = { scrape: vi.fn() };
    const result = await runMeteredResearchScrape({ store, provider, ...scope, input: { url: "https://example.org/next" } });
    expect(result.allowed).toBe(false);
    expect(provider.scrape).not.toHaveBeenCalled();
  });

  it("does not call the provider for a task in another workspace", async () => {
    const provider = { scrape: vi.fn() };
    await expect(runMeteredResearchScrape({ store: makeStore(), provider, workspaceId: "workspace-b", taskId: "article-a", input: { url: "https://example.org" } }))
      .rejects.toMatchObject({ status: 404 });
    expect(provider.scrape).not.toHaveBeenCalled();
  });

  it("replays an existing operation without scraping twice", async () => {
    const store = makeStore();
    const provider = { scrape: vi.fn() };
    store.state.researchScrapes.push({ workspaceId: scope.workspaceId, taskId: scope.taskId, reservationId: "scrape-retry-01", markdown: "saved" });
    const result = await runMeteredResearchScrape({ store, provider, ...scope, input: { url: "https://example.org" }, operationId: "retry-01" });
    expect(result.replayed).toBe(true);
    expect(provider.scrape).not.toHaveBeenCalled();
  });
});
