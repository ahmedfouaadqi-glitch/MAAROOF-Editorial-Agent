import { describe, expect, it } from "vitest";
import { analyzeEditorialDraft } from "./editorial-intelligence.mjs";

describe("analyzeEditorialDraft", () => {
  it("reports deterministic structure and GEO phrase coverage", () => {
    const report = analyzeEditorialDraft({
      title: "How editorial intelligence improves digital publishing",
      hook: "Editorial intelligence helps teams plan useful content.",
      body: [
        "## Research workflow",
        "Editorial intelligence connects research, evidence, and clear writing for digital publishing. Teams can use editorial intelligence to plan content with a defined audience.",
        "",
        "## Content quality",
        "A structured editorial workflow improves consistency. Digital publishing teams should review sources and claims before publication."
      ].join("\n"),
      geo: {
        primaryPhrase: "editorial intelligence",
        supportingTerms: ["digital publishing", "source review"],
        questions: ["How does editorial intelligence improve digital publishing?"],
        entities: ["editorial intelligence", "digital publishing"]
      },
      factCheckNotes: ["Verify current platform policy."]
    }, { targetName: "Website article", targetType: "article" });

    expect(report.method).toBe("deterministic-editorial-checklist");
    expect(report.metrics.headingCount).toBe(2);
    expect(report.geo.primaryPhraseOccurrences).toBeGreaterThan(0);
    expect(report.geo.supportingCoverage[0].occurrences).toBeGreaterThan(0);
    expect(report.geo.entityCoverage.every(item => item.mentioned)).toBe(true);
    expect(report.limitations.some(item => item.includes("not a search-engine ranking score"))).toBe(true);
  });

  it("does not invent keyword volume, ranking, or verification claims", () => {
    const report = analyzeEditorialDraft({
      title: "Short post",
      body: "A short editorial post with no headings.",
      geo: { primaryPhrase: "", supportingTerms: [], questions: [], entities: [] }
    }, { targetType: "social" });

    expect(report.metadataSuggestions.metaDescription).toBeTruthy();
    expect(report.recommendations.join(" ")).toContain("primary GEO phrase");
    expect(report.limitations.join(" ")).toContain("keyword volume");
    expect(report).not.toHaveProperty("rankingScore");
    expect(report).not.toHaveProperty("searchVolume");
  });

  it("rejects invalid draft input", () => {
    expect(() => analyzeEditorialDraft(null)).toThrow("A draft with a body string is required");
    expect(() => analyzeEditorialDraft({ body: 42 })).toThrow("A draft with a body string is required");
  });

  it("handles empty optional GEO arrays", () => {
    const report = analyzeEditorialDraft({ body: "Plain content." });
    expect(report.geo.supportingCoverage).toEqual([]);
    expect(report.geo.questionCoverage).toEqual([]);
    expect(report.geo.entityCoverage).toEqual([]);
  });
});
