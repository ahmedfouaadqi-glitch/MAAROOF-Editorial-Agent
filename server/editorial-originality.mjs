import { compareWorkspaceEditorialContent, normalizeEditorialText } from "./editorial-similarity.mjs";

function countWords(value) {
  const normalized = normalizeEditorialText(value);
  return normalized ? normalized.split(" ").length : 0;
}

/**
 * Workspace-scoped originality screening.
 * Signals indicate textual similarity only; they do not establish plagiarism,
 * authorship, source attribution, or originality across the public web.
 */
export function analyzeOriginality(state, workspaceId, candidateText, {
  clientId = null,
  brandId = null,
  minCandidateWords = 8,
  reviewThreshold = 0.45,
  strongSimilarityThreshold = 0.72,
  maxMatches = 10
} = {}) {
  if (typeof workspaceId !== "string" || !workspaceId.trim()) {
    throw new TypeError("workspaceId is required for originality analysis");
  }
  if (typeof candidateText !== "string") {
    throw new TypeError("candidateText must be a string");
  }
  if (!Number.isFinite(reviewThreshold) || reviewThreshold < 0 || reviewThreshold > 1 ||
      !Number.isFinite(strongSimilarityThreshold) || strongSimilarityThreshold < reviewThreshold || strongSimilarityThreshold > 1) {
    throw new TypeError("Originality thresholds must be ordered values between 0 and 1");
  }

  const candidateWordCount = countWords(candidateText);
  const comparison = compareWorkspaceEditorialContent(state, workspaceId, candidateText, {
    clientId, brandId, nearDuplicateThreshold: reviewThreshold, maxMatches
  });
  const exactMatches = comparison.exactMatches.map(match => ({ ...match, matchType: "exact" }));
  const nearMatches = comparison.nearMatches.map(match => ({
    ...match,
    matchType: match.similarity >= strongSimilarityThreshold ? "strong-lexical-overlap" : "partial-lexical-overlap"
  }));
  const findings = [...exactMatches, ...nearMatches].sort((a, b) => {
    if (a.matchType === "exact" && b.matchType !== "exact") return -1;
    if (b.matchType === "exact" && a.matchType !== "exact") return 1;
    return b.similarity - a.similarity;
  });
  const reviewRequired = findings.length > 0 || candidateWordCount < minCandidateWords;
  const strongestSimilarity = findings.reduce((max, item) => Math.max(max, item.similarity), 0);
  const status = candidateWordCount < minCandidateWords
    ? "insufficient-text"
    : exactMatches.length
      ? "exact-match-review"
      : nearMatches.some(item => item.similarity >= strongSimilarityThreshold)
        ? "strong-overlap-review"
        : nearMatches.length
          ? "possible-overlap-review"
          : "no-internal-match-found";

  return {
    version: 1,
    method: "workspace-scoped-deterministic-text-comparison",
    status,
    reviewRequired,
    candidateWordCount,
    comparisonScope: comparison.comparisonScope,
    comparedContentCount: comparison.comparedContentCount,
    comparedByType: comparison.comparedByType,
    signal: {
      strongestLexicalSimilarity: Number(strongestSimilarity.toFixed(4)),
      interpretation: candidateWordCount < minCandidateWords
        ? "The candidate is too short for a useful comparison; human review is required."
        : reviewRequired
          ? "Potential overlap detected; a human must inspect the matched passages, context, attribution, and reuse permissions."
          : "No qualifying match was found in the available workspace corpus. This is not proof of originality."
    },
    findings,
    thresholds: {
      reviewThreshold,
      strongSimilarityThreshold,
      minCandidateWords
    },
    limitations: [
      "The comparison corpus is limited to saved editorial drafts and checks available inside this workspace and selected client/brand identity scope.",
      "No public-web, academic-paper, paid plagiarism database, or external publisher corpus was queried.",
      "Lexical overlap can miss paraphrases and cross-language copying; it can also flag legitimate shared terminology, quotations, templates, and brief-derived language.",
      "A similarity signal is not a plagiarism verdict and does not determine authorship, copyright infringement, or permission to reuse.",
      "Human review must inspect matched passages, source attribution, quotation treatment, dates, and applicable reuse rights."
    ],
    analyzedAt: new Date().toISOString()
  };
}
