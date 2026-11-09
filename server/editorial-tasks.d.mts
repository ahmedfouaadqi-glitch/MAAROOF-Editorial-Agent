export interface EditorialTaskInput {
  workspaceId: string;
  topic: string;
  language?: "ar" | "en";
  objective?: "thought-leadership" | "news" | "analysis" | "educational" | "research-summary";
  targetPlatformId?: string;
  clientId?: string;
  brandId?: string;
  clientName?: string;
  brandName?: string;
}
export function createEditorialTask(state: { tasks: Record<string, unknown> }, input: EditorialTaskInput): unknown;
export function listEditorialTasks(state: { tasks: Record<string, unknown> }, workspaceId: string): unknown[];
export function advanceEditorialTask(state: { tasks: Record<string, unknown> }, input: { workspaceId: string; taskId: string; nextStage: string }): unknown;
