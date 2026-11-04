export type EditorialStage =
  | "intake"
  | "planning"
  | "research"
  | "entity-analysis"
  | "outline"
  | "drafting"
  | "source-review"
  | "originality-review"
  | "media-review"
  | "editorial-approval"
  | "ready-to-publish"
  | "publishing"
  | "publication-verification"
  | "completed"
  | "blocked"
  | "failed";

export interface EditorialTask {
  id: string;
  workspaceId: string;
  clientId?: string;
  brandId?: string;
  targetPlatformId?: string;
  language: "ar" | "en";
  topic: string;
  objective: "thought-leadership" | "news" | "analysis" | "educational" | "research-summary";
  targetAudience?: string;
  stage: EditorialStage;
  createdAt: string;
  updatedAt: string;
}

export interface EditorialEvidence {
  id: string;
  url: string;
  title: string;
  publisher?: string;
  publishedAt?: string;
  retrievedAt: string;
  claimIds: string[];
  verification: "unreviewed" | "corroborated" | "disputed" | "rejected";
}

export interface EditorialClaim {
  id: string;
  text: string;
  evidenceIds: string[];
  status: "supported" | "partially-supported" | "unsupported" | "needs-review";
}

export interface EditorialDraft {
  taskId: string;
  title: string;
  dek?: string;
  language: "ar" | "en";
  sections: Array<{ heading: string; body: string }>;
  metaTitle?: string;
  metaDescription?: string;
  entities: Array<{ name: string; type: string; relevance: "primary" | "secondary" }>;
  keywords: Array<{ term: string; intent: string; role: "primary" | "supporting" | "question" }>;
  claims: EditorialClaim[];
  evidence: EditorialEvidence[];
  editorialAngle: string;
  disclosure?: string;
  status: "outline" | "draft" | "needs-review" | "approved";
}

/**
 * Engine boundaries only. Implementations must be injected by backend services.
 * The browser UI must never pretend these contracts are live AI functionality.
 */
export interface PlanningEngine {
  createPlan(task: EditorialTask): Promise<{ steps: string[]; requiredInputs: string[] }>;
}
export interface ResearchEngine {
  collect(task: EditorialTask): Promise<EditorialEvidence[]>;
}
export interface EntityIntelligenceEngine {
  analyze(task: EditorialTask, evidence: EditorialEvidence[]): Promise<{ entities: EditorialDraft["entities"]; keywords: EditorialDraft["keywords"] }>;
}
export interface WritingEngine {
  draft(task: EditorialTask, evidence: EditorialEvidence[], analysis: { entities: EditorialDraft["entities"]; keywords: EditorialDraft["keywords"] }): Promise<EditorialDraft>;
}
export interface OriginalityEngine {
  inspect(draft: EditorialDraft, scope: { workspaceId: string; clientId?: string; brandId?: string }): Promise<{ status: "clear" | "review" | "blocked"; matches: Array<{ articleId: string; similarity: number; reason: string }> }>;
}

export const editorialPipeline: Array<{ stage: EditorialStage; label: string; requiresHumanGate: boolean }> = [
  { stage: "intake", label: "استلام الطلب", requiresHumanGate: false },
  { stage: "planning", label: "التخطيط التحريري", requiresHumanGate: false },
  { stage: "research", label: "البحث وجمع الأدلة", requiresHumanGate: false },
  { stage: "entity-analysis", label: "تحليل الكيانات والنية", requiresHumanGate: false },
  { stage: "outline", label: "بناء مخطط المقالة", requiresHumanGate: true },
  { stage: "drafting", label: "كتابة المسودة", requiresHumanGate: false },
  { stage: "source-review", label: "مراجعة الأدلة والادعاءات", requiresHumanGate: true },
  { stage: "originality-review", label: "فحص الأصالة والتكرار", requiresHumanGate: false },
  { stage: "media-review", label: "مراجعة الصور والحقوق", requiresHumanGate: true },
  { stage: "editorial-approval", label: "الموافقة التحريرية", requiresHumanGate: true },
  { stage: "ready-to-publish", label: "جاهز للنشر", requiresHumanGate: false },
  { stage: "publishing", label: "تنفيذ النشر", requiresHumanGate: true },
  { stage: "publication-verification", label: "التحقق الخارجي", requiresHumanGate: false },
  { stage: "completed", label: "مكتمل", requiresHumanGate: false }
];
