export type ResearchOperation = "source" | "scrape" | "search" | "inspect";

export interface ResearchBudgetLimits {
  sourceUrlsPerArticle: number;
  scrapesPerArticle: number;
  searchesPerArticle: number;
  inspectionsPerArticle: number;
}

export interface ResearchUsage {
  source: number;
  scrape: number;
  search: number;
  inspect: number;
}

export interface ResearchBudgetDecision {
  allowed: boolean;
  operation: ResearchOperation;
  used: number;
  limit: number;
  remaining: number;
  reason?: "limit-reached" | "invalid-limit" | "invalid-units";
}

export const DEFAULT_RESEARCH_BUDGET: Readonly<ResearchBudgetLimits> = Object.freeze({
  sourceUrlsPerArticle: 3,
  scrapesPerArticle: 3,
  searchesPerArticle: 5,
  inspectionsPerArticle: 5
});

export function validateResearchBudgetLimits(
  value: ResearchBudgetLimits
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [key, limit] of Object.entries(value)) {
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 10_000) {
      errors.push(`${key} must be an integer between 0 and 10000`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function getResearchLimit(
  limits: ResearchBudgetLimits,
  operation: ResearchOperation
): number {
  if (operation === "source") return limits.sourceUrlsPerArticle;
  if (operation === "scrape") return limits.scrapesPerArticle;
  if (operation === "search") return limits.searchesPerArticle;
  return limits.inspectionsPerArticle;
}

/**
 * Per-task budget guard. Source URLs, scrapes, searches and inspections are
 * counted independently. This in-memory implementation is suitable only for
 * a single-process prototype; production workers need a durable atomic store.
 */
export class ResearchBudgetLedger {
  private readonly usage = new Map<string, ResearchUsage>();

  constructor(private limits: ResearchBudgetLimits = { ...DEFAULT_RESEARCH_BUDGET }) {
    const validation = validateResearchBudgetLimits(limits);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
  }

  updateLimits(next: ResearchBudgetLimits): void {
    const validation = validateResearchBudgetLimits(next);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    this.limits = { ...next };
  }

  getLimits(): ResearchBudgetLimits {
    return { ...this.limits };
  }

  getUsage(taskId: string): ResearchUsage {
    const current = this.usage.get(taskId);
    return current ? { ...current } : { source: 0, scrape: 0, search: 0, inspect: 0 };
  }

  reserve(taskId: string, operation: ResearchOperation, units = 1): ResearchBudgetDecision {
    if (!taskId.trim()) throw new Error("taskId is required");
    if (!Number.isSafeInteger(units) || units < 1) {
      return { allowed: false, operation, used: this.getUsage(taskId)[operation], limit: getResearchLimit(this.limits, operation), remaining: 0, reason: "invalid-units" };
    }
    const current = this.getUsage(taskId);
    const used = current[operation];
    const limit = getResearchLimit(this.limits, operation);
    if (used + units > limit) {
      return { allowed: false, operation, used, limit, remaining: 0, reason: "limit-reached" };
    }

    const next = { ...current, [operation]: used + units };
    this.usage.set(taskId, next);
    return { allowed: true, operation, used: next[operation], limit, remaining: limit - next[operation] };
  }

  release(taskId: string, operation: ResearchOperation, units = 1): void {
    if (!Number.isSafeInteger(units) || units < 1) throw new Error("units must be a positive integer");
    const current = this.getUsage(taskId);
    this.usage.set(taskId, { ...current, [operation]: Math.max(0, current[operation] - units) });
  }

  clearTask(taskId: string): void {
    this.usage.delete(taskId);
  }
}
