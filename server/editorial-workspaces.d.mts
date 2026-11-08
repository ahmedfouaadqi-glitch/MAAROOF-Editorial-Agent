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
export function ensureDefaultWorkspaceCollection(state: Record<string, any>, now?: string): boolean;
export function listEditorialWorkspaces(state: Record<string, any>, locale?: "ar" | "en"): EditorialWorkspace[];
export function createEditorialWorkspace(state: Record<string, any>, input: { name: string }): EditorialWorkspace;
