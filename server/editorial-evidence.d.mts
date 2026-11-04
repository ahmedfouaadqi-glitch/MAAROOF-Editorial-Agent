export interface EditorialEvidenceScope {
  workspaceId: string;
  taskId: string;
}

export interface EditorialClaimInput extends EditorialEvidenceScope {
  text: string;
  sourceIds?: string[];
}

export interface OriginalityCheckInput extends EditorialEvidenceScope {
  text: string;
  nearDuplicateThreshold?: number;
}

export function normalizeEditorialText(value: string): string;
export function registerClaim(state: Record<string, any>, input: EditorialClaimInput): Record<string, any>;
export function listClaims(state: Record<string, any>, workspaceId: string, taskId: string): {
  claims: Array<Record<string, any>>;
  summary: {
    total: number;
    sourceLinked: number;
    unlinked: number;
    coveragePercent: number;
    note: string;
  };
};
export function checkOriginality(state: Record<string, any>, input: OriginalityCheckInput): Record<string, any>;
