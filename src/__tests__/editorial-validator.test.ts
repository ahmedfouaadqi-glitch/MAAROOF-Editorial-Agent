import { describe, expect, it } from "vitest";
import type { EditorialDraft } from "../domain/editorial-workflow";
import { validateEditorialDraft } from "../lib/editorial-validator";

const validDraft: EditorialDraft = {
  taskId: "task-1",
  title: "عنوان تجريبي",
  language: "ar",
  sections: [
    { heading: "المقدمة", body: "نص افتتاحي تجريبي." },
    { heading: "التحليل", body: "نص تحليلي تجريبي." }
  ],
  metaTitle: "عنوان محرك البحث",
  metaDescription: "وصف موجز للمقالة.",
  entities: [{ name: "كيان تجريبي", type: "Organization", relevance: "primary" }],
  keywords: [{ term: "كلمة مفتاحية", intent: "informational", role: "primary" }],
  claims: [{ id: "claim-1", text: "ادعاء تجريبي", evidenceIds: ["source-1"], status: "supported" }],
  evidence: [{
    id: "source-1",
    url: "https://example.org/report",
    title: "تقرير تجريبي",
    retrievedAt: "2026-11-04T00:00:00.000Z",
    claimIds: ["claim-1"],
    verification: "corroborated"
  }],
  editorialAngle: "زاوية تحليلية مستقلة",
  status: "draft"
};

describe("editorial draft structural validator", () => {
  it("accepts a structurally complete draft for editorial review", () => {
    const report = validateEditorialDraft(validDraft);
    expect(report.validForEditorialReview).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("blocks claims without a linked evidence record", () => {
    const report = validateEditorialDraft({
      ...validDraft,
      claims: [{ ...validDraft.claims[0], evidenceIds: [] }]
    });
    expect(report.validForEditorialReview).toBe(false);
    expect(report.issues.some(issue => issue.code === "claim-without-evidence")).toBe(true);
  });

  it("rejects invalid or non-http source URLs", () => {
    const report = validateEditorialDraft({
      ...validDraft,
      evidence: [{ ...validDraft.evidence[0], url: "javascript:alert(1)" }]
    });
    expect(report.validForEditorialReview).toBe(false);
    expect(report.checks.sourceUrlsWellFormed).toBe(false);
  });

  it("does not call structural checks a GEO or factuality score", () => {
    const report = validateEditorialDraft(validDraft);
    expect(report).not.toHaveProperty("geoScore");
    expect(report).not.toHaveProperty("factualityScore");
  });
});
