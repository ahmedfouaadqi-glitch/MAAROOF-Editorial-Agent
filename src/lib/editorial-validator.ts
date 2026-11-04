import type { EditorialDraft } from "../domain/editorial-workflow";

export type ValidationSeverity = "error" | "warning" | "info";
export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  location?: string;
}
export interface EditorialValidationReport {
  validForEditorialReview: boolean;
  issues: ValidationIssue[];
  checks: {
    titlePresent: boolean;
    bodyPresent: boolean;
    evidencePresent: boolean;
    claimsLinkedToEvidence: boolean;
    sourceUrlsWellFormed: boolean;
    metadataPresent: boolean;
  };
}

/**
 * Deterministic structural validation only.
 * It does not verify truth, source quality, originality, GEO performance,
 * search ranking, or whether a publication will cite the article.
 */
export function validateEditorialDraft(draft: EditorialDraft): EditorialValidationReport {
  const issues: ValidationIssue[] = [];
  const evidenceIds = new Set(draft.evidence.map(item => item.id));
  const titlePresent = draft.title.trim().length > 0;
  const bodyPresent = draft.sections.some(section => section.body.trim().length > 0);
  const evidencePresent = draft.evidence.length > 0;

  if (!titlePresent) issues.push({ code: "missing-title", severity: "error", message: "عنوان المقالة مطلوب." });
  if (draft.sections.length < 2) issues.push({ code: "insufficient-sections", severity: "warning", message: "يفضل أن تتضمن المقالة قسمين تحريريين على الأقل." });
  if (!bodyPresent) issues.push({ code: "missing-body", severity: "error", message: "نص المقالة فارغ." });
  if (!evidencePresent) issues.push({ code: "missing-evidence", severity: "error", message: "لا توجد مصادر مسجلة للمقالة." });

  let claimsLinkedToEvidence = true;
  for (const claim of draft.claims) {
    const linked = claim.evidenceIds.some(id => evidenceIds.has(id));
    if (!linked) {
      claimsLinkedToEvidence = false;
      issues.push({ code: "claim-without-evidence", severity: "error", message: "يوجد ادعاء دون مرجع مرتبط به.", location: claim.id });
    }
  }

  let sourceUrlsWellFormed = true;
  for (const evidence of draft.evidence) {
    try {
      const url = new URL(evidence.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
    } catch {
      sourceUrlsWellFormed = false;
      issues.push({ code: "invalid-source-url", severity: "error", message: "رابط المصدر غير صالح أو ليس HTTP(S).", location: evidence.id });
    }
  }

  const metadataPresent = Boolean(draft.metaTitle?.trim() && draft.metaDescription?.trim());
  if (!draft.metaTitle?.trim()) issues.push({ code: "missing-meta-title", severity: "warning", message: "Meta Title غير محدد." });
  if (!draft.metaDescription?.trim()) issues.push({ code: "missing-meta-description", severity: "warning", message: "Meta Description غير محدد." });
  if ((draft.metaTitle?.length ?? 0) > 60) issues.push({ code: "long-meta-title", severity: "info", message: "عنوان Meta يتجاوز 60 حرفاً؛ راجعه حسب متطلبات المنصة." });
  if ((draft.metaDescription?.length ?? 0) > 160) issues.push({ code: "long-meta-description", severity: "info", message: "وصف Meta يتجاوز 160 حرفاً؛ راجعه حسب متطلبات المنصة." });

  const validForEditorialReview = !issues.some(issue => issue.severity === "error");
  return {
    validForEditorialReview,
    issues,
    checks: {
      titlePresent,
      bodyPresent,
      evidencePresent,
      claimsLinkedToEvidence,
      sourceUrlsWellFormed,
      metadataPresent
    }
  };
}
