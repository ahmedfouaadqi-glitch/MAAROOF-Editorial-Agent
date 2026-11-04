export type ResearchOperation = "crawl" | "search" | "inspect";

export interface ResearchBudgetLimits {
  crawlUrlsPerArticle: number;
  searchesPerArticle: number;
  inspectionsPerArticle: number;
}

export interface ResearchUsage {
  crawl: number;
  search: number;
  inspect: number;
}

export interface ResearchBudgetDecision {
  allowed: boolean;
  operation: ResearchOperation;
  used: number;
  limit: number;
  remaining: number;
  reason?: "limit-reached" | "invalid-limit";
}

export const DEFAULT_RESEARCH_BUDGET: Readonly<ResearchBudgetLimits> = Object.freeze({
  crawlUrlsPerArticle: 3,
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
  if (operation === "crawl") return limits.crawlUrlsPerArticle;
  if (operation === "search") return limits.searchesPerArticle;
  return limits.inspectionsPerArticle;
}

/**
 * Per-task budget guard. reserve() must be called before invoking Firecrawl.
 * This in-memory implementation is suitable for a single-process prototype.
 * Production workers must inject a durable atomic store to coordinate replicas.
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
    return current ? { ...current } : { crawl: 0, search: 0, inspect: 0 };
  }

  reserve(taskId: string, operation: ResearchOperation): ResearchBudgetDecision {
    if (!taskId.trim()) throw new Error("taskId is required");
    const current = this.getUsage(taskId);
    const used = current[operation];
    const limit = getResearchLimit(this.limits, operation);
    if (used >= limit) {
      return { allowed: false, operation, used, limit, remaining: 0, reason: "limit-reached" };
    }

    const next = { ...current, [operation]: used + 1 };
    this.usage.set(taskId, next);
    return { allowed: true, operation, used: next[operation], limit, remaining: limit - next[operation] };
  }

  release(taskId: string, operation: ResearchOperation): void {
    const current = this.getUsage(taskId);
    this.usage.set(taskId, { ...current, [operation]: Math.max(0, current[operation] - 1) });
  }

  clearTask(taskId: string): void {
    this.usage.delete(taskId);
  }
}
