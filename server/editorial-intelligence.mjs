import { normalizeEditorialText } from "./editorial-evidence.mjs";

const STOP_WORDS = new Set([
  "the","and","for","with","from","that","this","into","your","about","are","was","were","will","have","has","you","our",
  "من","في","على","إلى","الى","عن","مع","هذا","هذه","ذلك","التي","الذي","هو","هي","ما","لا","لم","لن","قد","كان","كانت","أن","إن","او","أو","ثم","كما","بين","كل","بعد","قبل"
]);

function words(value) {
  return normalizeEditorialText(value).split(/\s+/u).filter(Boolean);
}

function countPhrase(text, phrase) {
  const haystack = ` ${normalizeEditorialText(text)} `;
  const needle = ` ${normalizeEditorialText(phrase)} `;
  if (needle.trim().length < 2) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function makeMetaDescription(draft) {
  const source = (draft.hook || draft.body || "").replace(/\s+/g, " ").trim();
  if (!source) return "";
  const sentence = source.split(/(?<=[.!?؟])\s+/u)[0] || source;
  return sentence.slice(0, 157).trim();
}

/**
 * Deterministic editorial QA. This is a transparent checklist, not an SEO ranking
 * prediction, fact checker, plagiarism detector, or answer-engine visibility score.
 */
export function analyzeEditorialDraft(draft, { targetName = "", targetType = "article" } = {}) {
  if (!draft || typeof draft !== "object" || typeof draft.body !== "string") {
    throw new TypeError("A draft with a body string is required");
  }

  const title = typeof draft.title === "string" ? draft.title.trim() : "";
  const hook = typeof draft.hook === "string" ? draft.hook.trim() : "";
  const body = draft.body.trim();
  const fullText = [title, hook, body, draft.callToAction || ""].join("\n");
  const tokens = words(body);
  const wordCount = tokens.length;
  const headings = [...body.matchAll(/^\s{0,3}#{1,6}\s+(.+)$/gm)].map(match => match[1].trim());
  const paragraphs = body.split(/\n\s*\n/u).map(part => part.trim()).filter(Boolean);
  const sentences = body.split(/[.!?؟]+/u).map(part => part.trim()).filter(Boolean);
  const avgSentenceWords = sentences.length ? Math.round(tokens.length / sentences.length * 10) / 10 : 0;
  const geo = draft.geo && typeof draft.geo === "object" ? draft.geo : {};
  const primaryPhrase = typeof geo.primaryPhrase === "string" ? geo.primaryPhrase.trim() : "";
  const supportingTerms = Array.isArray(geo.supportingTerms) ? unique(geo.supportingTerms.filter(item => typeof item === "string").map(item => item.trim())) : [];
  const questions = Array.isArray(geo.questions) ? unique(geo.questions.filter(item => typeof item === "string").map(item => item.trim())) : [];
  const entities = Array.isArray(geo.entities) ? unique(geo.entities.filter(item => typeof item === "string").map(item => item.trim())) : [];
  const primaryCount = countPhrase(fullText, primaryPhrase);
  const supportingCoverage = supportingTerms.map(term => ({ term, occurrences: countPhrase(fullText, term) }));
  const entityCoverage = entities.map(entity => ({ entity, mentioned: countPhrase(fullText, entity) > 0 }));
  const questionCoverage = questions.map(question => {
    const questionTerms = unique(words(question).filter(word => word.length > 2 && !STOP_WORDS.has(word)));
    const matchedTerms = questionTerms.filter(term => countPhrase(fullText, term) > 0);
    const coverage = questionTerms.length ? Math.round(matchedTerms.length / questionTerms.length * 100) : 0;
    return { question, matchedTerms, coveragePercent: coverage, status: coverage >= 60 ? "topic-covered-review" : "coverage-gap-review" };
  });

  const issues = [];
  const recommendations = [];
  if (!title) issues.push({ code: "title-missing", severity: "high", message: "The draft has no title." });
  else if (title.length < 30 || title.length > 70) recommendations.push("Review title length; the current title is outside the 30–70 character editorial guideline.");
  if (wordCount < 300 && targetType === "article") recommendations.push("The article is under 300 words; confirm that this depth is sufficient for the subject and publication.");
  if (headings.length < 2 && targetType === "article") recommendations.push("Add descriptive subheadings to improve scanability and clarify the article structure.");
  if (paragraphs.some(paragraph => words(paragraph).length > 120)) recommendations.push("Split long paragraphs into shorter units where the argument permits.");
  if (avgSentenceWords > 28) recommendations.push("Review long sentences for readability without flattening technical meaning.");
  if (primaryPhrase && primaryCount === 0) recommendations.push("The selected primary GEO phrase does not appear verbatim in the draft; use it only if it reads naturally and accurately.");
  if (primaryPhrase && wordCount > 0 && (primaryCount * words(primaryPhrase).length) / wordCount > 0.025) recommendations.push("The primary phrase may be over-repeated; review for natural language and remove unnecessary repetition.");
  if (!primaryPhrase) recommendations.push("No primary GEO phrase was supplied; select one from the actual topic and audience intent.");
  if (supportingCoverage.some(item => item.occurrences === 0)) recommendations.push("Some supporting phrases are absent. Add only those that improve topical completeness; do not force keyword insertion.");
  if (entityCoverage.some(item => !item.mentioned)) recommendations.push("Some selected entities are not mentioned. Confirm relevance and include only entities needed to explain the subject.");
  if (questionCoverage.some(item => item.status === "coverage-gap-review")) recommendations.push("Review answer-seeking questions with low lexical coverage; this heuristic does not determine whether a question is semantically answered.");
  if (!draft.factCheckNotes?.length) recommendations.push("No explicit fact-check notes were returned. This does not mean the claims have been verified.");

  const metaDescription = makeMetaDescription(draft);
  const checks = [
    { id: "title", status: title ? "pass" : "fail", value: title.length, unit: "characters" },
    { id: "body-length", status: wordCount >= (targetType === "article" ? 300 : 80) ? "pass" : "review", value: wordCount, unit: "words" },
    { id: "structure", status: headings.length >= 2 || targetType !== "article" ? "pass" : "review", value: headings.length, unit: "headings" },
    { id: "primary-phrase", status: primaryPhrase && primaryCount > 0 ? "pass" : "review", value: primaryCount, unit: "exact occurrences" },
    { id: "supporting-phrases", status: supportingCoverage.every(item => item.occurrences > 0) && supportingCoverage.length ? "pass" : "review", value: supportingCoverage.filter(item => item.occurrences > 0).length, unit: `of ${supportingCoverage.length} present` },
    { id: "entities", status: entityCoverage.every(item => item.mentioned) && entityCoverage.length ? "pass" : "review", value: entityCoverage.filter(item => item.mentioned).length, unit: `of ${entityCoverage.length} mentioned` },
    { id: "questions", status: questionCoverage.every(item => item.status === "topic-covered-review") && questionCoverage.length ? "review" : "review", value: questionCoverage.filter(item => item.coveragePercent >= 60).length, unit: `of ${questionCoverage.length} lexically covered; human review required` }
  ];

  return {
    version: 1,
    method: "deterministic-editorial-checklist",
    target: { name: String(targetName || "").slice(0, 160), type: String(targetType || "article").slice(0, 40) },
    metrics: { wordCount, headingCount: headings.length, paragraphCount: paragraphs.length, sentenceCount: sentences.length, averageSentenceWords: avgSentenceWords, titleCharacters: title.length },
    metadataSuggestions: { metaDescription },
    geo: { primaryPhrase, primaryPhraseOccurrences: primaryCount, supportingCoverage, questionCoverage, entityCoverage },
    checks,
    issues,
    recommendations: unique(recommendations),
    limitations: [
      "This report is deterministic editorial QA, not a search-engine ranking score or a GEO visibility measurement.",
      "Phrase counts and question overlap are lexical heuristics; they do not establish semantic relevance or answer completeness.",
      "No live search, source retrieval, independent fact verification, or external plagiarism check is performed by this analyzer.",
      "Search demand, keyword volume, CPC, rankings, citations, and answer-engine mentions are not measured."
    ],
    analyzedAt: new Date().toISOString()
  };
}
