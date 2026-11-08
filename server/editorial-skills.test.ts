import { describe, expect, it } from "vitest";
import { editorialSkillCatalogStats, listEditorialSkills, loadEditorialSkillGuidance, selectEditorialSkills } from "./editorial-skills.mjs";

describe("editorial skill library", () => {
  it("loads all source definitions and preserves both Humanizer variants", () => {
    expect(editorialSkillCatalogStats()).toEqual({
      definitionCount: 70,
      uniqueSkillCount: 69,
      counts: { blocked_on_integration: 11, can_run_now: 16, guidance_only: 43 }
    });
    const skills = listEditorialSkills();
    expect(skills).toHaveLength(70);
    expect(skills.every(skill => Boolean(skill.descriptionEn?.trim()))).toBe(true);
    expect(skills.filter(skill => skill.skillId === "humanizer").map(skill => skill.id).sort()).toEqual(["humanizer-v1", "humanizer-v2"]);
  });

  it("routes a declared source trigger for every non-fallback definition", async () => {
    const { readFileSync } = await import("node:fs");
    const catalog = JSON.parse(readFileSync(new URL("../skills/catalog.json", import.meta.url), "utf8")) as {
      skills: Array<{ id: string; skillId: string; triggers?: string[]; triggersEn?: string[] }>;
    };
    const definitions = catalog.skills.filter(skill => skill.id !== "content-creation");
    expect(definitions).toHaveLength(69);
    for (const sourceSkill of definitions) {
      const trigger = sourceSkill.triggers?.[0] || sourceSkill.triggersEn?.[0];
      expect(trigger, sourceSkill.id).toBeTruthy();
      const selected = selectEditorialSkills({ text: trigger, targetId: "linkedin", language: "en" });
      expect(selected.some(skill => skill.skillId === sourceSkill.skillId || skill.id === sourceSkill.id), sourceSkill.id).toBe(true);
      expect(selected.length).toBeLessThanOrEqual(2);
    }
  });

  it("routes Arabic and English article requests to an article skill and caps selection at two", () => {
    const arabic = selectEditorialSkills({ text: "اكتب مقالاً تحريرياً عن الأمن الرقمي للشركات الصغيرة", targetId: "wordpress", language: "ar" });
    const english = selectEditorialSkills({ text: "Write a long-form blog article about digital safety", targetId: "wordpress", language: "en" });
    expect(arabic.length).toBeGreaterThan(0);
    expect(arabic.length).toBeLessThanOrEqual(2);
    expect(arabic.some(skill => skill.skillId === "blog-write")).toBe(true);
    expect(english.length).toBeLessThanOrEqual(2);
    expect(english.some(skill => ["blog-write", "blog-rewrite"].includes(skill.skillId))).toBe(true);
    expect(english[0]?.purpose).not.toBe("Blog Write");
    expect(english[0]?.purpose).toMatch(/blog|article/i);
  });

  it("chooses one list/comparison template instead of stacking competing templates", () => {
    const listicle = selectEditorialSkills({ text: "Create a listicle of the best project management tools", targetId: "linkedin", language: "en" });
    const comparison = selectEditorialSkills({ text: "اكتب مقارنة بين أداتين لإدارة المشاريع", targetId: "wordpress", language: "ar" });
    const competing = new Set(["alternative-blog-writer", "comparison-article-writer", "listicle-blog-writer"]);
    expect(listicle.filter(skill => competing.has(skill.skillId)).map(skill => skill.skillId)).toEqual(["listicle-blog-writer"]);
    expect(comparison.filter(skill => competing.has(skill.skillId))).toHaveLength(1);
  });

  it("routes explicit GEO intent and does not add generic content creation as a competing primary", () => {
    const selected = selectEditorialSkills({ text: "اكتب مقالاً محسناً لمحركات البحث التوليدي GEO", targetId: "wordpress", language: "ar" });
    expect(selected[0]?.skillId).toBe("blog-write");
    expect(selected.some(skill => skill.skillId === "seo-aeo-best-practices" || skill.skillId === "ai-seo")).toBe(true);
    expect(selected.some(skill => skill.skillId === "content-creation")).toBe(false);
  });

  it("routes specialized non-post intents and keeps user-scoped campaigns from firing on generic language", () => {
    const cases = [
      ["Create a PRD for a bilingual editorial SaaS app", "create-prd"],
      ["Prepare a brief PRD by shaping the problem framing", "writing-prds"],
      ["Write a cover letter for a product manager role", "cover-letter-generator"],
      ["Develop a churn prevention plan for a subscription product", "churn-prevention"],
      ["Create a full multi-channel product campaign", "muapi-product-campaign"],
      ["Humanize this text but return only the final text", "humanizer-v2"],
      ["Please humanize this text and list remaining patterns", "humanizer-v1"]
    ] as const;
    for (const [text, skillId] of cases) {
      expect(selectEditorialSkills({ text, targetId: "linkedin", language: "en" }).some(skill => skill.skillId === skillId || skill.id === skillId), text).toBe(true);
    }
    const genericLaunch = selectEditorialSkills({ text: "Write a LinkedIn post about a new product launch", targetId: "linkedin", language: "en" });
    expect(genericLaunch[0]?.skillId).toBe("content-creation");
    expect(genericLaunch.some(skill => skill.skillId === "muapi-product-campaign")).toBe(false);
  });

  it("uses the previous skills for a short follow-up and adds saved brand guidance only when relevant", () => {
    const first = selectEditorialSkills({ text: "Write an article for our startup audience", targetId: "wordpress", language: "en" });
    const followUp = selectEditorialSkills({ text: "Make it shorter", targetId: "wordpress", language: "en", priorSelections: first });
    const branded = selectEditorialSkills({
      text: "Write a LinkedIn post about product onboarding",
      targetId: "linkedin", language: "en", brandProfile: { voice: "Clear and direct" }
    });
    expect(followUp.map(skill => skill.id)).toEqual(first.map(skill => skill.id));
    expect(followUp.every(skill => skill.reason.includes("Continues"))).toBe(true);
    expect(branded.some(skill => skill.skillId === "applying-brand-guidelines")).toBe(true);
    expect(branded.length).toBeLessThanOrEqual(2);
  });

  it("loads only selected guidance and keeps oversized source skills within the context limit", async () => {
    const selected = selectEditorialSkills({ text: "Please proofread this text for grammar and clarity", targetId: "linkedin", language: "en" });
    const guidance = await loadEditorialSkillGuidance(selected);
    expect(guidance).toContain("Selected source skill:");
    expect(guidance).toContain(selected[0].skillId);
    expect(guidance.length).toBeLessThanOrEqual(12_000);
    expect(guidance).not.toContain("# Account Research");
  });

  it("preserves an unavailable integration as a limitation rather than inventing an available tool", () => {
    const selected = selectEditorialSkills({ text: "Conduct live keyword research and show search volume", targetId: "wordpress", language: "en" });
    const keywordSkill = selected.find(skill => skill.skillId === "keyword-research");
    expect(keywordSkill?.runtimeStatus).toBe("blocked_on_integration");
  });
});
