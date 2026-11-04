export const AI_VISIBILITY_EVENT_TYPES: readonly string[];
export function classifyBot(userAgentOrName: string): { botName: string; purpose: string };
export function recordVisibilityEvent(state: Record<string, unknown>, input: Record<string, unknown>): Record<string, unknown>;
export function listVisibilityEvents(state: Record<string, unknown>, workspaceId: string): Array<Record<string, unknown>>;
export function summarizeVisibility(events: Array<Record<string, unknown>>): {
  crawlerFetches: number;
  searchIndexVerified: number;
  citationsVerified: number;
  trainingAttestations: number;
  referralVisits: number;
  uniqueUrls: number;
  providers: Record<string, number>;
};
