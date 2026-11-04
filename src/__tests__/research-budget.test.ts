import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESEARCH_BUDGET,
  ResearchBudgetLedger,
  validateResearchBudgetLimits
} from "../domain/research-budget";

describe("research budget configuration", () => {
  it("starts with the requested conservative defaults", () => {
    expect(DEFAULT_RESEARCH_BUDGET).toEqual({
      sourceUrlsPerArticle: 3,
      searchesPerArticle: 5,
      inspectionsPerArticle: 5
    });
  });

  it("rejects negative, fractional and excessively large limits", () => {
    expect(validateResearchBudgetLimits({
      sourceUrlsPerArticle: -1,
      searchesPerArticle: 1.5,
      inspectionsPerArticle: 10_001
    }).valid).toBe(false);
  });

  it("enforces source, search and inspection limits independently per article", () => {
    const ledger = new ResearchBudgetLedger();
    expect(ledger.reserve("article-a", "source", 3)).toMatchObject({ allowed: true, used: 3, limit: 3, remaining: 0 });
    expect(ledger.reserve("article-a", "source", 1)).toMatchObject({
      allowed: false, used: 3, limit: 3, remaining: 0, reason: "limit-reached"
    });
    expect(ledger.reserve("article-a", "source", 0).reason).toBe("invalid-units");

    for (let i = 0; i < 5; i++) expect(ledger.reserve("article-a", "search").allowed).toBe(true);
    expect(ledger.reserve("article-a", "search").allowed).toBe(false);

    for (let i = 0; i < 5; i++) expect(ledger.reserve("article-a", "inspect").allowed).toBe(true);
    expect(ledger.reserve("article-a", "inspect").allowed).toBe(false);
  });

  it("isolates usage between article tasks", () => {
    const ledger = new ResearchBudgetLedger();
    ledger.reserve("article-a", "source");
    expect(ledger.getUsage("article-a").source).toBe(1);
    expect(ledger.getUsage("article-b").source).toBe(0);
  });

  it("allows an administrator to change limits and releases a failed reservation", () => {
    const ledger = new ResearchBudgetLedger();
    ledger.updateLimits({ sourceUrlsPerArticle: 1, searchesPerArticle: 2, inspectionsPerArticle: 4 });
    expect(ledger.reserve("article-a", "source").allowed).toBe(true);
    expect(ledger.reserve("article-a", "source").allowed).toBe(false);
    ledger.release("article-a", "source");
    expect(ledger.reserve("article-a", "source").allowed).toBe(true);
  });
});
