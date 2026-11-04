export interface EditorialTaskInput {
  workspaceId: string;
  topic: string;
  language?: "ar" | "en";
  objective?: "thought-leadership" | "news" | "analysis" | "educational" | "research-summary";
  targetPlatformId?: string;
  clientId?: string;
  brandId?: string;
}
export function createEditorialTask(state: { tasks: Record<string, unknown> }, input: EditorialTaskInput): any;
export function listEditorialTasks(state: { tasks: Record<string, any> }, workspaceId: string): any[];
export function advanceEditorialTask(state: { tasks: Record<string, any> }, input: { workspaceId: string; taskId: string; nextStage: string }): any;
