export interface EditorialWorkspace {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_WORKSPACE_ID: string;
export const DEFAULT_WORKSPACE_NAME: string;
export function ensureDefaultWorkspaceCollection(state: Record<string, unknown>, now?: string): boolean;
export function listEditorialWorkspaces(state: Record<string, unknown>, locale?: "ar" | "en"): EditorialWorkspace[];
export function createEditorialWorkspace(state: Record<string, unknown>, input: { name: string }): EditorialWorkspace;
