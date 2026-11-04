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
export function assessSource(state: Record<string, any>, input: SourceAssessmentInput): Record<string, any>;
export function recordEvidence(state: Record<string, any>, input: RecordEvidenceInput): Record<string, any>;
export function listResearch(state: Record<string, any>, workspaceId: string, taskId: string): Record<string, any>;
