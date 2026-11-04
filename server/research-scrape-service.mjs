import { randomUUID } from "node:crypto";
import { commitReservation, reserveBudget } from "./research-budget.mjs";
import { validateScrapeTarget } from "./firecrawl-provider.mjs";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function runMeteredResearchScrape({ store, provider, workspaceId, taskId, input, operationId }) {
  if (!provider || typeof provider.scrape !== "function") fail("Firecrawl scraping is not configured", 503);
  const url = validateScrapeTarget(input?.url);
  const snapshot = await store.read();
  const task = snapshot.tasks?.[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) fail("Editorial task not found", 404);

  const reservationId = typeof operationId === "string" && operationId.length >= 8 && operationId.length <= 128
    ? "scrape-" + operationId
    : "scrape-" + randomUUID();

  const prior = (snapshot.researchScrapes || []).find(item =>
    item.workspaceId === workspaceId && item.taskId === taskId && item.reservationId === reservationId
  );
  if (prior) return { allowed: true, replayed: true, result: prior };

  const reservation = await store.transact(state => reserveBudget(state, {
    workspaceId, taskId, operation: "scrape", units: 1, reservationId
  }));
  if (!reservation.allowed) return { allowed: false, quota: reservation };

  let scraped;
  try {
    scraped = await provider.scrape(url);
  } catch (error) {
    // A timeout or provider error may occur after Firecrawl accepted the request.
    await store.transact(state => commitReservation(state, { workspaceId, taskId, reservationId }));
    throw error;
  }

  const saved = await store.transact(state => {
    commitReservation(state, { workspaceId, taskId, reservationId });
    state.sources ||= [];
    state.researchScrapes ||= [];
    const canonicalUrl = scraped.url || url;
    let source = state.sources.find(item =>
      item.workspaceId === workspaceId && item.taskId === taskId && item.url === canonicalUrl
    );
    if (!source) {
      source = {
        id: randomUUID(), workspaceId, taskId, url: canonicalUrl,
        title: scraped.title || (typeof input.title === "string" ? input.title.slice(0, 300) : ""),
        notes: "Content retrieved through Firecrawl. Claims remain unverified.",
        submittedBy: "admin",
        registeredAt: new Date().toISOString(),
        acquisition: "firecrawl-v2-scrape",
        fetched: true,
        verificationState: "scraped-content-unverified",
        contentMarkdown: scraped.markdown
      };
      state.sources.push(source);
    } else {
      source.title = source.title || scraped.title || "";
      source.fetched = true;
      source.acquisition = "firecrawl-v2-scrape";
      source.verificationState = "scraped-content-unverified";
      source.contentMarkdown = scraped.markdown;
      source.fetchedAt = scraped.retrievedAt;
    }
    const record = {
      id: randomUUID(), workspaceId, taskId, sourceId: source.id,
      ...scraped, reservationId, recordedAt: new Date().toISOString()
    };
    state.researchScrapes.push(record);
    const current = state.tasks[taskId];
    const limit = (state.limits || {}).scrapesPerArticle ?? 3;
    return {
      record,
      sourceId: source.id,
      quota: { operation: "scrape", used: current.usage.scrape, limit, remaining: Math.max(0, limit - current.usage.scrape) }
    };
  });

  return { allowed: true, replayed: false, result: saved.record, sourceId: saved.sourceId, quota: saved.quota };
}
