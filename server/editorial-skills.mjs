import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const catalog = JSON.parse(readFileSync(new URL("../skills/catalog.json", import.meta.url), "utf8"));
const MAX_SELECTED_SKILLS = 2;
const MAX_SKILL_GUIDANCE_CHARS = 12_000;
const catalogSkills = Array.isArray(catalog.skills) ? catalog.skills : [];
const byId = new Map(catalogSkills.map(skill => [skill.id, skill]));
const bySkillId = new Map();
for (const skill of catalogSkills) {
  const list = bySkillId.get(skill.skillId) || [];
  list.push(skill);
  bySkillId.set(skill.skillId, list);
}

if (catalog.definitionCount !== 70 || catalogSkills.length !== 70 || byId.size !== 70) {
  throw new Error("Editorial skill catalog is incomplete or contains duplicate runtime IDs.");
}

const STOP_WORDS = new Set((
  "about after again also and are can could create draft for from have help how into make more new not of on or our please post blog article content write writing social marketing the this that user wants want use using when where which who will would " +
  "في من على عن الى إلى أن ان او أو ثم هذا هذه ذلك التي الذي ما ماذا كيف هل لي لنا حول عند مع يكون تكون اريد أريد ابي ابيها بالنسبة حسب بشكل ممكن لو كان كانت من فضلك نص شيء شي " +
  "والذي والتي"
).split(/\s+/));

const FOLLOW_UP_CUES = [
  "shorter", "shorten", "expand", "continue", "refine", "revise", "rewrite", "translate", "make it", "same draft",
  "اختصر", "اختصره", "اختصري", "وسع", "وسّع", "تابع", "حسّن", "حسن", "عدّل", "عدل", "ترجم", "ترجمه", "اجعله", "اجعلها", "نفس المسودة", "طورها", "طوّرها"
];

const CONFLICT_GROUPS = [
  new Set(["alternative-blog-writer", "comparison-article-writer", "listicle-blog-writer"]),
  new Set(["blog-write", "content-creation", "copywriting"]),
  new Set(["blog-rewrite", "copy-editing", "grammar-check", "humanizer-v1", "humanizer-v2", "no-ai-slop", "stop-slop"]),
  new Set(["ai-seo", "seo-aeo-best-practices"]),
  new Set(["keyword-research", "content-gap-analysis", "seo-competitor-analysis", "seo-audit", "seo-content-audit"])
];

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token) {
  let value = token;
  if (/^[\u0600-\u06FF]+$/.test(value)) {
    value = value.replace(/^(وال|بال|كال|فال|لل|ال|و|ف|ب|ك|ل)/, "");
    value = value.replace(/(يات|ات|ون|ين|ان|ها|هم|هن|كم|كن|نا|ه|ي)$/u, "");
  } else {
    value = value.replace(/(ingly|edly|ing|ed|ies|es|s)$/u, match => match === "ies" ? "y" : "");
  }
  return value;
}

function tokens(value) {
  return normalize(value).split(/\s+/).map(stem).filter(token => token.length >= 2 && !STOP_WORDS.has(token));
}

function scoreTrigger(text, trigger) {
  const normalizedText = normalize(text);
  const normalizedTrigger = normalize(trigger);
  if (!normalizedText || !normalizedTrigger) return 0;
  if (normalizedTrigger.length >= 4 && normalizedText.includes(normalizedTrigger)) return 9 + Math.min(2, normalizedTrigger.length / 80);
  const triggerTokens = [...new Set(tokens(normalizedTrigger))];
  if (!triggerTokens.length) return 0;
  const textTokens = new Set(tokens(normalizedText));
  const overlap = triggerTokens.filter(token => textTokens.has(token)).length;
  const required = Math.min(4, Math.max(2, Math.ceil(triggerTokens.length * 0.35)));
  if (overlap < required) return 0;
  return 2 + overlap + overlap / triggerTokens.length;
}

function firstMeaningfulMatch(text, skill) {
  let best = { score: 0, trigger: "" };
  for (const trigger of [...(skill.triggers || []), ...(skill.triggersEn || [])]) {
    const score = scoreTrigger(text, trigger);
    if (score > best.score) best = { score, trigger };
  }
  return best;
}

export function isEditorialFollowUp(text) {
  const normalizedText = normalize(text);
  const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;
  return normalizedText.length <= 160 && wordCount <= 18 && FOLLOW_UP_CUES.some(cue => normalizedText.includes(normalize(cue)));
}

function reasonFor(language, reasonType) {
  if (language === "en") {
    if (reasonType === "continuation") return "Continues the immediately preceding editorial workflow.";
    if (reasonType === "destination-default") return "Default editorial workflow for the chosen destination.";
    if (reasonType === "brand-context") return "Added because a saved brand profile is active for this request.";
    return "Matched to the request intent and the skill's declared triggers.";
  }
  if (reasonType === "continuation") return "تتابع مسار التحرير المستخدم في الرسالة السابقة.";
  if (reasonType === "destination-default") return "المسار التحريري الافتراضي للوجهة المحددة.";
  if (reasonType === "brand-context") return "أضيفت لوجود دليل علامة محفوظ ومستخدم في هذا الطلب.";
  return "طابقت نية الطلب ومحفزات المهارة المعلنة.";
}

function isConflicting(first, candidate) {
  if (first.id === candidate.id || first.skillId === candidate.skillId) return true;
  return CONFLICT_GROUPS.some(group => group.has(first.id) && group.has(candidate.id));
}

function selectionSummary(skill, language, reasonType) {
  return {
    id: skill.id,
    skillId: skill.skillId,
    variant: skill.variant || null,
    category: skill.category,
    runtimeStatus: skill.runtimeStatus,
    purpose: language === "en" ? String(skill.descriptionEn || skill.purposeEn || skill.skillId).slice(0, 300) : String(skill.purposeAr || skill.skillId).slice(0, 300),
    reason: reasonFor(language, reasonType)
  };
}

function promote(ranked, id, trigger) {
  const skill = byId.get(id) || (bySkillId.get(id) || [])[0];
  if (!skill) return;
  const index = ranked.findIndex(item => item.skill.id === skill.id);
  const existing = index >= 0 ? ranked.splice(index, 1)[0] : null;
  ranked.unshift({ skill, score: Math.max(10, existing?.score || 0), trigger, manual: true });
}

export function listEditorialSkills() {
  return catalogSkills.map(skill => ({
    id: skill.id,
    skillId: skill.skillId,
    variant: skill.variant || null,
    category: skill.category,
    purposeAr: skill.purposeAr,
    purposeEn: skill.purposeEn,
    descriptionEn: skill.descriptionEn,
    runtimeStatus: skill.runtimeStatus,
    dependencies: skill.dependencies
  }));
}

export function selectEditorialSkills({ text, targetId = "", language = "ar", brandProfile = null, priorSelections = [] } = {}) {
  const message = typeof text === "string" ? text : "";
  const locale = language === "en" ? "en" : "ar";
  if (isEditorialFollowUp(message)) {
    const previous = (priorSelections || []).slice(0, MAX_SELECTED_SKILLS)
      .map(item => byId.get(item.id || item.skillId))
      .filter(Boolean);
    if (previous.length) return previous.map(skill => selectionSummary(skill, locale, "continuation"));
  }

  const normalizedText = normalize(message);
  const hasCue = cues => cues.some(cue => normalizedText.includes(normalize(cue)));
  const ranked = catalogSkills.map(skill => ({ skill, ...firstMeaningfulMatch(message, skill) }))
    .filter(item => item.score >= 3.5 && item.skill.skillId !== "content-creation" && !(item.skill.skillId === "muapi-product-campaign" && !hasCue(["campaign", "campaign assets", "product campaign", "muapi"])))
    .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id));

  const listCues = ["قائمه", "listicle", "top 10", "best tools", "افضل"];
  const comparisonCues = ["مقارنه", "بدائل", "alternatives", "compare", "comparison"];
  const articleCues = ["مقال", "مدونه", "blog", "article", "longform"];

  if (hasCue(["keyword research", "search volume", "keyword volume", "بحث كلمات مفتاحيه", "بحث الكلمات المفتاحيه", "حجم البحث"])) {
    promote(ranked, "keyword-research", "keyword research intent");
  } else if (hasCue(["fact check", "fact-check", "verify citations", "citation accuracy", "تدقيق الادعاءات", "تحقق من الادعاءات", "تحقق من الحقائق"])) {
    promote(ranked, "blog-factcheck", "fact-check intent");
  } else if (hasCue(["content audit", "eeat", "citation readiness", "تدقيق المحتوى", "تدقيق جودة المقال", "جاهزيه الاقتباس"])) {
    promote(ranked, "seo-content-audit", "content audit intent");
  } else if (hasCue(["seo audit", "organic search audit", "تدقيق seo", "تدقيق محركات البحث"])) {
    promote(ranked, "seo-audit", "SEO audit intent");
  } else if (hasCue(["competitor seo", "seo competitor", "competitor analysis", "تحليل المنافسين", "تحليل منافس"])) {
    promote(ranked, "seo-competitor-analysis", "competitor analysis intent");
  } else if (hasCue(["content gap", "topic gap", "فجوات المحتوى", "فجوه المحتوى"])) {
    promote(ranked, "content-gap-analysis", "content gap intent");
  } else if (hasCue(["create a prd", "write a prd", "product requirements document", "prd", "وثيقه متطلبات المنتج", "وثيقه المتطلبات", "مواصفات المنتج"])) {
    const skillId = hasCue(["brief prd", "problem framing", "initial scope", "شكل الفكرة", "صياغه المشكله", "صياغة المشكلة"]) ? "writing-prds" : "create-prd";
    promote(ranked, skillId, "product requirements document intent");
  } else if (hasCue(["cover letter", "cover-letter", "خطاب تغطيه", "خطاب التقديم"])) {
    promote(ranked, "cover-letter-generator", "cover letter intent");
  } else if (hasCue(["churn prevention", "reduce churn", "prevent churn", "customer churn", "تقليل فقد العملاء", "منع تسرب العملاء", "تقليل الالغاء", "احتفاظ العملاء"])) {
    promote(ranked, "churn-prevention", "customer retention intent");
  } else if (hasCue(listCues)) {
    promote(ranked, "listicle-blog-writer", "list format intent");
  } else if (hasCue(comparisonCues)) {
    promote(ranked, hasCue(["بدائل", "alternatives"]) ? "alternative-blog-writer" : "comparison-article-writer", "comparison intent");
  } else if (hasCue(["translate", "translation", "ترجم", "ترجمه", "ترجمه المقال"]) && hasCue(articleCues)) {
    promote(ranked, "blog-translate", "article translation intent");
  } else if (hasCue(["repurpose", "إعادة توظيف", "اعاده توظيف", "حوّل المقال", "حول المقال"])) {
    promote(ranked, "blog-repurpose", "content repurposing intent");
  } else if (hasCue(["rewrite", "إعادة كتابة", "اعادة كتابه", "تحديث المقال", "حسّن المقال", "حسن المقال"]) && hasCue(articleCues)) {
    promote(ranked, "blog-rewrite", "article rewrite intent");
  } else if (hasCue(["proofread", "proofreading", "grammar", "تدقيق لغوي", "اخطاء لغويه", "أخطاء لغوية"])) {
    promote(ranked, "grammar-check", "proofreading intent");
  } else if (hasCue(["humanizer", "humanize", "humanise", "less robotic", "less ai-sounding", "طبيعي وبصوت الكاتب", "تبدو طبيعيه", "بصوت الكاتب"]) && hasCue(["humanizer v2", "humanizer 2", "humanizer second", "only the final text", "text only", "فقط النص النهائي", "النص فقط"])) {
    promote(ranked, "humanizer-v2", "humanizer concise-output variant");
  } else if (hasCue(["humanizer", "humanize", "humanise", "less robotic", "less ai-sounding", "طبيعي وبصوت الكاتب", "تبدو طبيعيه", "بصوت الكاتب"])) {
    promote(ranked, "humanizer-v1", "humanization request");
  } else if (hasCue(["write a post", "create a post", "draft a post", "social post", "social media post", "linkedin post", "اكتب منشور", "كتابة منشور", "اكتب بوست", "منشور على", "بوست على"])) {
    promote(ranked, "content-creation", "social post intent");
  } else if (hasCue(articleCues)) {
    promote(ranked, "blog-write", "article creation intent");
  }

  if (hasCue(["geo", "aeo", "seo", "محركات الاجابه", "محركات البحث التوليدي", "ظهور الذكاء الاصطناعي"]) && !ranked.some(entry => ["ai-seo", "seo-aeo-best-practices"].includes(entry.skill.skillId))) {
    const item = byId.get("seo-aeo-best-practices");
    if (item) ranked.push({ skill: item, score: 7, trigger: "GEO/SEO intent", manual: true });
  }

  if (!ranked.length && targetId) {
    const fallback = byId.get("content-creation");
    if (fallback) ranked.push({ skill: fallback, score: 1, trigger: "destination fallback", fallback: true });
  }

  const selected = [];
  for (const entry of ranked) {
    if (!selected.length) {
      selected.push({ skill: entry.skill, score: entry.score, matched: !entry.fallback });
      continue;
    }
    if (selected.length >= MAX_SELECTED_SKILLS) break;
    if (entry.score < Math.max(3.5, selected[0].score * 0.45)) continue;
    if (isConflicting(selected[0].skill, entry.skill)) continue;
    selected.push({ skill: entry.skill, score: entry.score, matched: !entry.fallback });
  }

  const profileHasContext = brandProfile && Object.values(brandProfile).some(value => typeof value === "string" && value.trim());
  const primaryIsContent = selected[0] && ["editorial", "marketing"].includes(selected[0].skill.category);
  if (profileHasContext && primaryIsContent && selected.length < MAX_SELECTED_SKILLS && !selected.some(item => item.skill.skillId === "applying-brand-guidelines")) {
    const brandSkill = byId.get("applying-brand-guidelines");
    if (brandSkill && !isConflicting(selected[0].skill, brandSkill)) selected.push({ skill: brandSkill, score: 1, matched: false, brandContext: true });
  }

  return selected.slice(0, MAX_SELECTED_SKILLS).map(item => selectionSummary(item.skill, locale,
    item.brandContext ? "brand-context" : item.matched ? "intent" : "destination-default"));
}

function clip(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function compactSkill(skill, budget) {
  const lines = [
    `Skill: ${skill.skillId}${skill.variant ? ` (${skill.variant})` : ""}`,
    `Purpose: ${clip(skill.purposeAr || skill.purposeEn || skill.skillId, 700)}`,
    `Inputs: ${(skill.inputs || []).slice(0, 5).map(item => clip(item, 220)).join("; ")}`,
    `Expected output: ${clip(skill.output || "Follow the user's requested deliverable.", 700)}`,
    `Workflow: ${(skill.workflow || []).slice(0, 6).map(item => clip(item, 420)).join("; ")}`,
    `Dependencies: ${(skill.dependencies || []).slice(0, 5).map(item => clip(item, 260)).join("; ")}`,
    `Integration boundary: ${clip(skill.integrationRule || "Do not claim unavailable integrations.", 650)}`,
    `Safety constraints: ${(skill.safetyConstraints || []).slice(0, 7).map(item => clip(item, 280)).join("; ")}`
  ];
  const result = lines.join("\n");
  if (result.length <= budget) return result;
  const purpose = lines.slice(0, 2).join("\n");
  const integration = lines[6];
  const safety = lines[7];
  const mandatory = `${purpose}\n${integration}\n${safety}`;
  if (mandatory.length >= budget) return mandatory.slice(0, budget);
  const workflowAndIO = lines.slice(2, 6).join("\n");
  const space = Math.max(0, budget - mandatory.length - workflowAndIO.length - 4);
  return `${purpose}\n${workflowAndIO.slice(0, space)}\n${integration}\n${safety}`;
}

export async function loadEditorialSkillGuidance(selections = []) {
  const chosen = (selections || []).slice(0, MAX_SELECTED_SKILLS).map(selection => ({ selection, skill: byId.get(selection.id) })).filter(item => item.skill);
  if (!chosen.length) return "";
  const envelopeBudget = 320;
  const perSkillBudget = Math.floor((MAX_SKILL_GUIDANCE_CHARS - chosen.length * envelopeBudget) / chosen.length);
  const chunks = [];
  let used = 0;
  for (const { selection, skill } of chosen) {
    const header = `[Selected source skill: ${skill.skillId}${skill.variant ? ` · ${skill.variant}` : ""} · ${skill.runtimeStatus}]\nSelection rationale: ${selection.reason}\n`;
    const contentBudget = Math.max(0, Math.min(perSkillBudget, MAX_SKILL_GUIDANCE_CHARS - used - header.length));
    if (!contentBudget) break;
    const source = await readFile(new URL(`../${skill.sourcePath}`, import.meta.url), "utf8");
    const guidance = source.length <= contentBudget ? source : compactSkill(skill, contentBudget);
    const envelope = `${header}${guidance}`;
    chunks.push(envelope);
    used += envelope.length;
  }
  return chunks.join("\n\n");
}

export function editorialSkillCatalogStats() {
  const counts = {};
  for (const skill of catalogSkills) counts[skill.runtimeStatus] = (counts[skill.runtimeStatus] || 0) + 1;
  return { definitionCount: catalog.definitionCount, uniqueSkillCount: catalog.uniqueSkillCount, counts };
}
