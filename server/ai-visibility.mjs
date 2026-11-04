import { randomUUID } from "node:crypto";

export const AI_VISIBILITY_EVENT_TYPES = [
  "crawler_fetch",
  "search_index_verified",
  "citation_verified",
  "training_attestation",
  "referral_visit"
];

const BOT_PURPOSE = {
  "GPTBot": "training_candidate",
  "OAI-SearchBot": "ai_search_crawler",
  "ChatGPT-User": "user_requested_fetch",
  "Googlebot": "search_crawler",
  "Google-Extended": "training_and_grounding_control_token_not_http_bot",
  "ClaudeBot": "training_candidate",
  "Claude-SearchBot": "ai_search_crawler",
  "Claude-User": "user_requested_fetch",
  "PerplexityBot": "ai_search_crawler",
  "Perplexity-User": "user_requested_fetch",
  "Bytespider": "unknown_or_provider_specific",
  "CCBot": "common_crawl",
  "Amazonbot": "provider_crawler"
};

const ALLOWED = new Set(AI_VISIBILITY_EVENT_TYPES);
const clean = (value, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function classifyBot(userAgentOrName) {
  const value = clean(userAgentOrName, 1000);
  const name = Object.keys(BOT_PURPOSE).find(bot => value.toLowerCase().includes(bot.toLowerCase())) || "Unknown";
  return { botName: name, purpose: BOT_PURPOSE[name] || "unknown" };
}

export function recordVisibilityEvent(state, input) {
  const workspaceId = clean(input.workspaceId, 128);
  const articleId = clean(input.articleId, 128);
  const url = clean(input.url, 2048);
  const eventType = clean(input.eventType, 64);
  if (!workspaceId || !url || !ALLOWED.has(eventType)) {
    throw Object.assign(new Error("workspaceId, valid URL, and supported eventType are required"), { status: 400 });
  }
  let parsed;
  try { parsed = new URL(url); } catch { throw Object.assign(new Error("Invalid URL"), { status: 400 }); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error("Only HTTP(S) URLs are accepted"), { status: 400 });
  const source = clean(input.source, 40) || "manual";
  const bot = classifyBot(input.bot || input.userAgent || "");
  if (eventType === "crawler_fetch" && bot.botName === "Unknown" && source !== "manual") {
    throw Object.assign(new Error("Unrecognized crawler; do not classify an unknown request as an AI crawler"), { status: 400 });
  }
  if ((eventType === "training_attestation" || (input.verified === true && ["search_index_verified", "citation_verified"].includes(eventType))) && (!clean(input.evidenceUrl, 2048) || !clean(input.evidenceNote, 2000))) {
    throw Object.assign(new Error("Verified indexing, citation, or training claims require an evidence URL and verification note"), { status: 400 });
  }
  if (!Array.isArray(state.aiVisibilityEvents)) state.aiVisibilityEvents = [];
  const event = {
    id: randomUUID(),
    workspaceId,
    articleId: articleId || null,
    url: parsed.toString(),
    eventType,
    provider: clean(input.provider, 120) || (bot.botName !== "Unknown" ? bot.botName : "Unspecified"),
    botName: bot.botName,
    botPurpose: bot.purpose,
    source,
    observedAt: clean(input.observedAt, 64) || new Date().toISOString(),
    evidenceUrl: clean(input.evidenceUrl, 2048) || null,
    evidenceNote: clean(input.evidenceNote, 2000) || null,
    verified: input.verified === true,
    verificationMethod: clean(input.verificationMethod, 300) || "manual_unverified",
    createdAt: new Date().toISOString()
  };
  state.aiVisibilityEvents.push(event);
  return event;
}

export function listVisibilityEvents(state, workspaceId) {
  return (state.aiVisibilityEvents || [])
    .filter(event => event.workspaceId === workspaceId)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export function summarizeVisibility(events) {
  const summary = {
    crawlerFetches: 0,
    searchIndexVerified: 0,
    citationsVerified: 0,
    trainingAttestations: 0,
    referralVisits: 0,
    uniqueUrls: new Set(),
    providers: {}
  };
  for (const event of events) {
    summary.uniqueUrls.add(event.url);
    if (event.eventType === "crawler_fetch") summary.crawlerFetches++;
    if (event.eventType === "search_index_verified" && event.verified) summary.searchIndexVerified++;
    if (event.eventType === "citation_verified" && event.verified) summary.citationsVerified++;
    if (event.eventType === "training_attestation" && event.verified) summary.trainingAttestations++;
    if (event.eventType === "referral_visit") summary.referralVisits++;
    summary.providers[event.provider] = (summary.providers[event.provider] || 0) + 1;
  }
  return { ...summary, uniqueUrls: summary.uniqueUrls.size };
}
