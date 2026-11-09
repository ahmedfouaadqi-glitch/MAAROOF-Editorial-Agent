export interface ResearchScope { workspaceId: string; taskId: string; }
export interface SourceAssessmentInput extends ResearchScope {
  sourceId: string;
  author?: string;
  publisher?: string;
  sourceType?: "primary" | "official" | "academic" | "news" | "industry" | "opinion" | "reference" | "unspecified";
  publishedAt?: string | null;
  updatedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  jurisdiction?: string;
  methodology?: string;
  qualityRating?: "high" | "medium" | "low" | "unassessed";
  qualityRationale?: string;
  assessmentNotes?: string;
}
export interface RecordEvidenceInput extends ResearchScope {
  sourceId: string;
  claimId: string;
  excerpt: string;
  locator?: string;
  note?: string;
  stance?: "supports" | "contradicts" | "contextualizes" | "unclear";
  observedAt?: string;
}
export function assessSource(state: Record<string, unknown>, input: SourceAssessmentInput): Record<string, unknown>;
export function recordEvidence(state: Record<string, unknown>, input: RecordEvidenceInput): Record<string, unknown>;
export function listResearch(state: Record<string, unknown>, workspaceId: string, taskId: string): Record<string, unknown>;
