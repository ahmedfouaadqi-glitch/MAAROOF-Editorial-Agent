import { describe, expect, it } from "vitest";
import { getEditorialTarget, listEditorialTargets } from "./editorial-targets.mjs";

describe("chat editorial target catalog", () => {
  it("contains the existing social, magazine and community targets plus supplied community destinations", () => {
    const targets = listEditorialTargets();
    expect(targets).toHaveLength(25);
    for (const id of ["linkedin", "instagram", "reddit", "quora", "stack-exchange", "dev-community", "hashnode", "medium", "substack", "wordpress"]) {
      expect(targets.some(target => target.id === id)).toBe(true);
    }
  });

  it("has bilingual descriptions, audience scope, platform style and at least one format", () => {
    for (const target of listEditorialTargets()) {
      expect(target.descriptionAr).toBeTruthy();
      expect(target.descriptionEn).toBeTruthy();
      expect(target.scopeAr).toBeTruthy();
      expect(target.scopeEn).toBeTruthy();
      expect(target.styleSummaryAr).toBeTruthy();
      expect(target.styleSummaryEn).toBeTruthy();
      expect(target.formats.length).toBeGreaterThan(0);
    }
  });

  it("returns destination-specific rules and rejects unknown or disabled targets", () => {
    expect(getEditorialTarget("reddit").styleSummaryEn).toContain("subreddit rules");
    expect(getEditorialTarget("quora").styleSummaryEn).toContain("Answer the question directly");
    expect(getEditorialTarget("stack-exchange").styleSummaryEn).toContain("verifiable answer");
    expect(() => getEditorialTarget("common-crawl")).toThrow("Editorial target is not available");
  });
});
