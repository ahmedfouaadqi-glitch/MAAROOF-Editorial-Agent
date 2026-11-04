import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { JsonStore } from "./store.mjs";
import { DEFAULT_LIMITS, validateLimits, reserveBudget, releaseReservation, commitReservation } from "./research-budget.mjs";
import { createEditorialTask, listEditorialTasks, advanceEditorialTask } from "./editorial-tasks.mjs";
import { registerClaim, listClaims, checkOriginality } from "./editorial-evidence.mjs";
import { createEntity, listEntities, scanKnownEntities, createEntityRelationship, listEntityRelationships } from "./editorial-entities.mjs";
import { assessSource, recordEvidence, listResearch } from "./editorial-research.mjs";
import { recordVisibilityEvent, listVisibilityEvents, summarizeVisibility } from "./ai-visibility.mjs";
import { createMagazineSubmission, listMagazineSubmissions, transitionMagazineSubmission } from "./magazine-submissions.mjs";
import { buildEditorialOutline, getEditorialDraft, updateEditorialDraft } from "./editorial-drafts.mjs";
import { runMeteredResearchSearch } from "./research-search-service.mjs";
import { createBraveSearchProvider } from "./brave-search-provider.mjs";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const adminToken = process.env.ADMIN_API_TOKEN || "";
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const dataFile = resolve(process.env.DATA_FILE || "./data/editorial-agent.json");
const store = new JsonStore(dataFile);
const searchProvider = process.env.RESEARCH_SEARCH_PROVIDER === "brave"
  ? createBraveSearchProvider()
  : null;

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}
function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolveBody(body ? JSON.parse(body) : {}); }
      catch { reject(Object.assign(new Error("Invalid JSON body"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
function requireAdmin(req) {
  if (!adminToken) throw Object.assign(new Error("ADMIN_API_TOKEN is not configured"), { status: 503 });
  if (req.headers.authorization !== `Bearer ${adminToken}`) throw Object.assign(new Error("Unauthorized"), { status: 401 });
}
function validateScope(body) {
  if (typeof body.workspaceId !== "string" || !body.workspaceId.trim() || body.workspaceId.length > 128) {
    throw Object.assign(new Error("workspaceId is required"), { status: 400 });
  }
  if (typeof body.taskId !== "string" || !body.taskId.trim() || body.taskId.length > 128) {
    throw Object.assign(new Error("taskId is required"), { status: 400 });
  }
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin === allowedOrigin) res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, service: "maaroof-editorial-api", persistence: "local-json", integrations: { supabase: false, firecrawl: false, liveSearch: Boolean(searchProvider), searchProvider: searchProvider?.id || null } });
    }

    requireAdmin(req);

    if (req.method === "GET" && url.pathname === "/api/v1/admin/ai-visibility") {
      const workspaceId = url.searchParams.get("workspaceId") || "main-workspace";
      const state = await store.read();
      const events = listVisibilityEvents(state, workspaceId);
      return send(res, 200, { events, summary: summarizeVisibility(events), limitations: {
        crawlerFetch: "Only observed events explicitly ingested or manually recorded are shown; no server/CDN access-log integration is currently connected.",
        indexing: "Requires a verifiable search/index result or official inspection evidence; crawler visits do not prove indexing.",
        citations: "Requires a captured answer/result URL or screenshot and manual verification; indexing does not prove citation.",
        training: "Cannot be inferred from crawling. Record only an explicit provider statement/attestation with evidence."
      } });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/admin/ai-visibility/events") {
      const body = await readJson(req);
      const event = await store.transact(state => recordVisibilityEvent(state, body));
      return send(res, 201, { event });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/admin/research-limits") {
      const state = await store.read();
      return send(res, 200, { limits: state.limits || DEFAULT_LIMITS });
    }
    if (req.method === "PUT" && url.pathname === "/api/v1/admin/research-limits") {
      const body = await readJson(req);
      const checked = validateLimits(body.limits);
      if (!checked.valid) return send(res, 400, { error: "Invalid limits", details: checked.errors });
      const result = await store.transact(state => {
        state.limits = { ...body.limits };
        return state.limits;
      });
      return send(res, 200, { limits: result, saved: true });
    }

    const articleCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/articles$/);
    if (articleCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(articleCollection[1]);
      const state = await store.read();
      return send(res, 200, { articles: listEditorialTasks(state, workspaceId) });
    }
    if (articleCollection && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(articleCollection[1]);
      const task = await store.transact(state => createEditorialTask(state, { ...body, workspaceId }));
      return send(res, 201, { article: { id: task.id, workspaceId: task.workspaceId, ...task.article } });
    }

    const articleStage = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/articles\/([^/]+)\/stage$/);
    if (articleStage && req.method === "PUT") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(articleStage[1]);
      const taskId = decodeURIComponent(articleStage[2]);
      const article = await store.transact(state => advanceEditorialTask(state, { workspaceId, taskId, nextStage: body.nextStage }));
      return send(res, 200, { article });
    }

    const editorialDraftRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/draft$/);
    if (editorialDraftRoute && req.method === "GET") {
      const state = await store.read();
      return send(res, 200, { draft: getEditorialDraft(state, decodeURIComponent(editorialDraftRoute[1]), decodeURIComponent(editorialDraftRoute[2])) });
    }
    if (editorialDraftRoute && req.method === "POST") {
      const body = await readJson(req);
      const draft = await store.transact(state => buildEditorialOutline(state, {
        workspaceId: decodeURIComponent(editorialDraftRoute[1]), taskId: decodeURIComponent(editorialDraftRoute[2]),
        angle: body.angle, audience: body.audience, keyQuestions: body.keyQuestions
      }));
      return send(res, 201, { draft, generation: "deterministic-scaffold", externalAction: "none" });
    }
    if (editorialDraftRoute && req.method === "PUT") {
      const body = await readJson(req);
      const draft = await store.transact(state => updateEditorialDraft(state, {
        workspaceId: decodeURIComponent(editorialDraftRoute[1]), taskId: decodeURIComponent(editorialDraftRoute[2]), ...body
      }));
      return send(res, 200, { draft });
    }

    const magazineSubmissionCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/magazine-submissions$/);
    if (magazineSubmissionCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(magazineSubmissionCollection[1]);
      const taskId = decodeURIComponent(magazineSubmissionCollection[2]);
      const state = await store.read();
      return send(res, 200, { submissions: listMagazineSubmissions(state, workspaceId, taskId) });
    }
    if (magazineSubmissionCollection && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(magazineSubmissionCollection[1]);
      const taskId = decodeURIComponent(magazineSubmissionCollection[2]);
      const submission = await store.transact(state => createMagazineSubmission(state, { ...body, workspaceId, taskId }));
      return send(res, 201, { submission, externalAction: "none" });
    }

    const magazineSubmissionStatus = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/magazine-submissions\/([^/]+)\/status$/);
    if (magazineSubmissionStatus && req.method === "PUT") {
      const body = await readJson(req);
      const submission = await store.transact(state => transitionMagazineSubmission(state, {
        workspaceId: decodeURIComponent(magazineSubmissionStatus[1]),
        taskId: decodeURIComponent(magazineSubmissionStatus[2]),
        submissionId: decodeURIComponent(magazineSubmissionStatus[3]),
        nextStatus: body.nextStatus,
        note: body.note
      }));
      return send(res, 200, { submission, externalAction: "none" });
    }

    const searchCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/research\/searches$/);
    if (searchCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(searchCollection[1]);
      const taskId = decodeURIComponent(searchCollection[2]);
      const state = await store.read();
      const task = state.tasks?.[taskId];
      if (!task || task.workspaceId !== workspaceId || !task.article) return send(res, 404, { error: "Editorial task not found" });
      const searches = (state.researchSearches || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
      return send(res, 200, { searches, usage: task.usage || { search: 0 }, limitations: ["Search results are discovery leads, not verified evidence."] });
    }
    if (req.method === "POST" && searchCollection) {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(searchCollection[1]);
      const taskId = decodeURIComponent(searchCollection[2]);
      const outcome = await runMeteredResearchSearch({
        store, provider: searchProvider, workspaceId, taskId, input: body
      });
      if (!outcome.allowed) return send(res, 429, { error: "Per-article search limit reached", quota: outcome.quota });
      return send(res, 200, outcome);
    }

    const reservationMatch = url.pathname.match(/^\/api\/v1\/tasks\/([^/]+)\/research-reservations$/);
    if (reservationMatch && req.method === "POST") {
      const body = await readJson(req);
      validateScope(body);
      const result = await store.transact(state => reserveBudget(state, {
        ...body, taskId: decodeURIComponent(reservationMatch[1])
      }));
      return send(res, result.allowed ? 200 : 429, result);
    }

    const reservationAction = url.pathname.match(/^\/api\/v1\/tasks\/([^/]+)\/research-reservations\/([^/]+)\/(release|commit)$/);
    if (reservationAction && req.method === "POST") {
      const body = await readJson(req);
      validateScope(body);
      const input = { ...body, taskId: decodeURIComponent(reservationAction[1]), reservationId: decodeURIComponent(reservationAction[2]) };
      const result = await store.transact(state => reservationAction[3] === "release" ? releaseReservation(state, input) : commitReservation(state, input));
      return send(res, 200, result);
    }

    const usageMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/research-usage$/);
    if (usageMatch && req.method === "GET") {
      const state = await store.read();
      const task = state.tasks[decodeURIComponent(usageMatch[2])];
      if (!task || task.workspaceId !== decodeURIComponent(usageMatch[1])) return send(res, 404, { error: "Task not found" });
      return send(res, 200, { usage: task.usage, reservations: task.reservations, limits: state.limits });
    }

    const sourceListMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/sources$/);
    if (sourceListMatch && req.method === "GET") {
      const workspaceId = decodeURIComponent(sourceListMatch[1]);
      const taskId = decodeURIComponent(sourceListMatch[2]);
      const state = await store.read();
      const sources = state.sources.filter(source => source.workspaceId === workspaceId && source.taskId === taskId);
      return send(res, 200, { sources });
    }

    const claimsMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/claims$/);
    if (claimsMatch && req.method === "GET") {
      const workspaceId = decodeURIComponent(claimsMatch[1]);
      const taskId = decodeURIComponent(claimsMatch[2]);
      const state = await store.read();
      return send(res, 200, listClaims(state, workspaceId, taskId));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/claims") {
      const body = await readJson(req);
      validateScope(body);
      const claim = await store.transact(state => registerClaim(state, body));
      return send(res, 201, { claim });
    }

    const researchMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/research$/);
    if (researchMatch && req.method === "GET") {
      const state = await store.read();
      return send(res, 200, listResearch(state, decodeURIComponent(researchMatch[1]), decodeURIComponent(researchMatch[2])));
    }
    if (req.method === "PUT" && url.pathname === "/api/v1/sources/assessment") {
      const body = await readJson(req);
      validateScope(body);
      const source = await store.transact(state => assessSource(state, body));
      return send(res, 200, { source, note: "Manual metadata assessment only. The source content was not fetched or independently verified." });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/research/evidence") {
      const body = await readJson(req);
      validateScope(body);
      const evidence = await store.transact(state => recordEvidence(state, body));
      return send(res, 201, { evidence, note: "This is a manually recorded excerpt and editorial stance, not independent verification." });
    }

    const entitiesMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/entities$/);
    if (entitiesMatch && req.method === "GET") {
      const workspaceId = decodeURIComponent(entitiesMatch[1]);
      const taskId = decodeURIComponent(entitiesMatch[2]);
      const state = await store.read();
      return send(res, 200, listEntities(state, workspaceId, taskId));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/entities") {
      const body = await readJson(req);
      validateScope(body);
      const entity = await store.transact(state => createEntity(state, body));
      return send(res, 201, { entity });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/entities/scan") {
      const body = await readJson(req);
      validateScope(body);
      const result = await store.transact(state => scanKnownEntities(state, body));
      return send(res, 200, { result });
    }
    if (req.method === "GET" && url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/entity-relationships$/)) {
      const match = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/entity-relationships$/);
      const state = await store.read();
      return send(res, 200, { relationships: listEntityRelationships(state, decodeURIComponent(match[1]), decodeURIComponent(match[2])) });
    }
    if (req.method === "POST" && url.pathname === "/api/v1/entity-relationships") {
      const body = await readJson(req);
      validateScope(body);
      const relationship = await store.transact(state => createEntityRelationship(state, body));
      return send(res, 201, { relationship });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/originality/check") {
      const body = await readJson(req);
      validateScope(body);
      const result = await store.transact(state => checkOriginality(state, body));
      return send(res, 200, { result });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/sources") {
      const body = await readJson(req);
      validateScope(body);
      if (typeof body.url !== "string" || body.url.length > 2048) return send(res, 400, { error: "A source URL is required" });
      let parsed;
      try { parsed = new URL(body.url); } catch { return send(res, 400, { error: "Invalid source URL" }); }
      if (!["http:", "https:"].includes(parsed.protocol)) return send(res, 400, { error: "Only HTTP(S) source URLs are accepted" });
      const sourceId = randomUUID();
      const result = await store.transact(state => {
        const quota = reserveBudget(state, {
          workspaceId: body.workspaceId, taskId: body.taskId, operation: "source",
          units: 1, reservationId: `source-${sourceId}`
        });
        if (!quota.allowed) return { quota, source: null };
        const source = {
          id: sourceId, workspaceId: body.workspaceId, taskId: body.taskId,
          url: parsed.toString(), title: typeof body.title === "string" ? body.title.slice(0, 300) : "",
          notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : "",
          submittedBy: "admin", registeredAt: new Date().toISOString(),
          acquisition: "user-supplied-reference", fetched: false, quotaReservationId: `source-${sourceId}`
        };
        state.sources.push(source);
        return { quota, source };
      });
      if (!result.source) return send(res, 429, { error: "Per-article source URL limit reached", quota: result.quota });
      return send(res, 201, { source: result.source, fetched: false, note: "Source URL registered only. No crawler or remote fetch was executed." });
    }
    return send(res, 404, { error: "Not found" });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || "Internal server error" });
  }
});

await store.init();
server.listen(port, host, () => {
  console.log(`MAAROOF Editorial API listening on http://${host}:${port}`);
  console.log("Supabase: disabled | Firecrawl: disabled | Persistence: local JSON");
});
