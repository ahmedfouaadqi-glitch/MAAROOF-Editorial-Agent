export interface ResearchLimits {
  sourceUrlsPerArticle: number;
  searchesPerArticle: number;
  inspectionsPerArticle: number;
}
export interface BudgetState {
  limits: ResearchLimits;
  tasks: Record<string, {
    workspaceId: string;
    usage: { source: number; search: number; inspect: number };
    reservations: Record<string, { operation: "source" | "search" | "inspect"; units: number; status: "reserved" | "committed" | "released" }>;
  }>;
  sources: unknown[];
}
export const DEFAULT_LIMITS: Readonly<ResearchLimits>;
export function validateLimits(value: ResearchLimits): { valid: boolean; errors: string[] };
export function reserveBudget(state: BudgetState, input: { taskId: string; workspaceId: string; operation: "source" | "search" | "inspect"; units?: number; reservationId: string }): { allowed: boolean; replayed?: boolean; operation?: string; used?: number; limit?: number; remaining?: number; reason?: string; usage?: unknown };
export function releaseReservation(state: BudgetState, input: { taskId: string; workspaceId: string; reservationId: string }): { released: boolean; replayed: boolean; usage: unknown };
export function commitReservation(state: BudgetState, input: { taskId: string; workspaceId: string; reservationId: string }): { committed: boolean; replayed: boolean };
