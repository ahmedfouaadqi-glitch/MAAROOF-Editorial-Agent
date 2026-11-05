import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { JsonStore } from "./store.mjs";
import { createWorkspace, getWorkspace, listWorkspaces, updateWorkspace } from "./editorial-workspaces.mjs";
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
import { createFirecrawlProvider } from "./firecrawl-provider.mjs";
import { runMeteredResearchScrape } from "./research-scrape-service.mjs";
import { runResearchInspection } from "./research-inspection.mjs";
import { checkEditorialDraftOriginality, getEditorialApproval, recordEditorialReview } from "./editorial-approval.mjs";
import { getCurrentMediaReview, recordMediaReview } from "./editorial-media.mjs";
import { runEditorialDraftGeneration } from "./editorial-writing.mjs";
import { generatePlatformVariant, listPlatformVariants } from "./platform-content.mjs";
import { createOpenAICompatibleProvider } from "./model-provider.mjs";
import { createMediaAsset, deleteMediaAsset, listMediaAssets, resolveMediaAssetFile } from "./editorial-media-assets.mjs";
import { getGeoBrief, getGeoReadiness, updateGeoBrief } from "./editorial-geo.mjs";
import { listEditorialBrands, listEditorialClients } from "./editorial-identities.mjs";
import { createBrowserAgentClient } from "./browser-agent-client.mjs";
import { createEditorialConversation, listEditorialConversations, getEditorialConversation, appendEditorialConversationMessage, updateEditorialConversationRun } from "./editorial-conversations.mjs";
import { listEditorialLibraryItems } from "./editorial-library.mjs";
import { createConversationAttachment, listConversationAttachments, resolveConversationAttachmentFile, deleteConversationAttachment } from "./editorial-conversation-attachments.mjs";
import { listEditorialTargets } from "./editorial-targets.mjs";
import { createEditorialConversationProgress, runEditorialConversation, cancelEditorialConversationRun } from "./editorial-conversation-runner.mjs";
import {
  buildApprovedArticleForBrowser, getBrowserDestination, getBrowserSession,
  listBrowserDestinations, listBrowserSessions, registerBrowserDestination,
  removeBrowserSession, saveBrowserSession, updateBrowserSession
} from "./browser-publishing.mjs";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const adminToken = process.env.ADMIN_API_TOKEN || "";
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const dataFile = resolve(process.env.DATA_FILE || "./data/editorial-agent.json");
const mediaDir = resolve(process.env.MEDIA_DIR || "./data/media");
const store = new JsonStore(dataFile);
const browserAgentRequest = createBrowserAgentClient();
const firecrawlProvider = createFirecrawlProvider();
const searchProvider = process.env.RESEARCH_SEARCH_PROVIDER === "firecrawl"
  ? firecrawlProvider
  : process.env.RESEARCH_SEARCH_PROVIDER === "brave"
    ? createBraveSearchProvider()
    : null;
// Independent OpenAI-compatible provider; secrets remain server-side and no MAAROOF AI link is used.
const modelProvider = createOpenAICompatibleProvider();
// Reuse the same independent provider for existing social adaptation when explicitly enabled.
const platformContentProvider = process.env.PLATFORM_CONTENT_GENERATION_ENABLED === "true"
  ? modelProvider
  : null;
const configuredModelTokens = Number(process.env.MODEL_MAX_OUTPUT_TOKENS || 3000);
const modelMaxOutputTokens = Number.isSafeInteger(configuredModelTokens) && configuredModelTokens >= 256 && configuredModelTokens <= 8192 ? configuredModelTokens : 3000;
const configuredModelRequests = Number(process.env.MODEL_REQUESTS_PER_ARTICLE || 2);
const modelRequestsPerArticle = Number.isSafeInteger(configuredModelRequests) && configuredModelRequests >= 1 && configuredModelRequests <= 10 ? configuredModelRequests : 2;

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}
function sendAttachmentFile(res, filePath, asset) {
  const filename = encodeURIComponent(asset.originalName || "attachment");
  res.writeHead(200, {
    "content-type": asset.mimeType,
    "content-length": String(asset.sizeBytes),
    "content-disposition": `inline; filename*=UTF-8''${filename}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff"
  });
  const stream = createReadStream(filePath);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
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
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,idempotency-key,x-file-name,x-media-description");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, service: "maaroof-editorial-api", persistence: "local-json", integrations: { supabase: false, firecrawl: Boolean(firecrawlProvider), liveSearch: Boolean(searchProvider), searchProvider: searchProvider?.id || null, modelGeneration: Boolean(modelProvider), model: modelProvider?.model || null, browserAgentConfigured: (process.env.BROWSER_AGENT_TOKEN || "").length >= 32 } });
    }

    requireAdmin(req);

    if (url.pathname === "/api/v1/workspaces" && req.method === "GET") {
      const state = await store.read();
      return send(res, 200, { workspaces: listWorkspaces(state) });
    }
    if (url.pathname === "/api/v1/workspaces" && req.method === "POST") {
      const body = await readJson(req);
      const workspace = await store.transact(state => createWorkspace(state, body));
      return send(res, 201, { workspace });
    }
    const workspaceItem = url.pathname.match(/^\\/api\\/v1\\/workspaces\\/([^/]+)$/);
    if (workspaceItem && req.method === "GET") {
      const workspaceId = decodeURIComponent(workspaceItem[1]);
      const state = await store.read();
      return send(res, 200, { workspace: getWorkspace(state, workspaceId) });
    }
    if (workspaceItem && req.method === "PATCH") {
      const workspaceId = decodeURIComponent(workspaceItem[1]);
      const body = await readJson(req);
      const workspace = await store.transact(state => updateWorkspace(state, workspaceId, body));
      return send(res, 200, { workspace });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/editorial-targets") {
      return send(res, 200, { targets: listEditorialTargets() });
    }

    const libraryCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/library$/);
    if (libraryCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(libraryCollection[1]);
      const state = await store.read();
      return send(res, 200, { items: listEditorialLibraryItems(state, workspaceId) });
    }

    const conversationsCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/conversations$/);
    if (conversationsCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(conversationsCollection[1]);
      return send(res, 200, { conversations: await listEditorialConversations(store, workspaceId) });
    }
    if (conversationsCollection && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(conversationsCollection[1]);
      const conversation = await createEditorialConversation(store, {
        ...body, workspaceId, targetId: body.targetId, language: body.language || "ar"
      });
      return send(res, 201, { conversation });
    }

    const conversationMessages = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/conversations\/([^/]+)\/messages$/);
    if (conversationMessages && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(conversationMessages[1]);
      const conversationId = decodeURIComponent(conversationMessages[2]);
      const snapshot = await getEditorialConversation(store, workspaceId, conversationId);
      const existing = typeof body.clientMessageId === "string"
        ? snapshot.messages.find(message => message.clientMessageId === body.clientMessageId)
        : null;
      if (existing) {
        const requestedAttachments = Array.isArray(body.attachmentIds) ? [...body.attachmentIds].sort() : [];
        const existingAttachments = [...(existing.attachmentIds || [])].sort();
        const requestedLanguage = body.language || snapshot.language;
        if (existing.content !== (typeof body.content === "string" ? body.content.trim() : "") || JSON.stringify(existingAttachments) !== JSON.stringify(requestedAttachments) || existing.targetId !== (body.targetId || snapshot.targetId) || (existing.language || snapshot.language) !== requestedLanguage) {
          return send(res, 409, { error: "clientMessageId was already used for different content." });
        }
        return send(res, 200, { message: existing, conversation: snapshot, replayed: true });
      }
      if (snapshot.activeRun && ["queued", "running"].includes(snapshot.activeRun.status)) {
        return send(res, 409, { error: "Wait for the current editorial run to finish before sending another message." });
      }
      const runId = randomUUID();
      const requestedLanguage = body.language || snapshot.language;
      const initialProgress = createEditorialConversationProgress(requestedLanguage);
      await updateEditorialConversationRun(store, {
        workspaceId, conversationId, runId, status: "queued",
        metadata: { ...initialProgress, queuedAt: new Date().toISOString() }
      });
      let message;
      try {
        message = await appendEditorialConversationMessage(store, {
          workspaceId, conversationId, role: "user", content: body.content,
          attachmentIds: body.attachmentIds || [], clientMessageId: body.clientMessageId,
          targetId: body.targetId || snapshot.targetId, language: requestedLanguage
        });
      } catch (error) {
        await updateEditorialConversationRun(store, {
          workspaceId, conversationId, runId, status: "failed",
          metadata: { ...initialProgress, error: "invalid-message", finishedAt: new Date().toISOString() }
        }).catch(() => {});
        throw error;
      }
      await updateEditorialConversationRun(store, {
        workspaceId, conversationId, runId, status: "queued",
        metadata: { ...initialProgress, queuedAt: new Date().toISOString(), userMessageId: message.id }
      });
      setImmediate(() => {
        void runEditorialConversation({ store, provider: modelProvider, workspaceId, conversationId, runId, userMessageId: message.id, mediaDir })
          .catch(error => console.error("Editorial conversation run failed:", error?.message || "unknown error"));
      });
      return send(res, 202, { accepted: true, runId, message, conversation: await getEditorialConversation(store, workspaceId, conversationId) });
    }

    const conversationAttachments = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/conversations\/([^/]+)\/attachments(?:\/([^/]+)(?:\/(file))?)?$/);
    if (conversationAttachments) {
      const workspaceId = decodeURIComponent(conversationAttachments[1]);
      const conversationId = decodeURIComponent(conversationAttachments[2]);
      const attachmentId = conversationAttachments[3] ? decodeURIComponent(conversationAttachments[3]) : "";
      const action = conversationAttachments[4] || "";
      if (!attachmentId && req.method === "GET") {
        return send(res, 200, { attachments: await listConversationAttachments(store, workspaceId, conversationId) });
      }
      if (!attachmentId && req.method === "POST") {
        const asset = await createConversationAttachment({ req, store, workspaceId, conversationId, mediaDir });
        return send(res, 201, { attachment: asset });
      }
      if (attachmentId && action === "file" && req.method === "GET") {
        const { asset, filePath } = await resolveConversationAttachmentFile({ store, workspaceId, conversationId, attachmentId, mediaDir });
        return sendAttachmentFile(res, filePath, asset);
      }
      if (attachmentId && !action && req.method === "DELETE") {
        return send(res, 200, await deleteConversationAttachment({ store, workspaceId, conversationId, attachmentId, mediaDir }));
      }
      return send(res, 405, { error: "Method not allowed" });
    }

    const conversationCancel = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/conversations\/([^/]+)\/cancel$/);
    if (conversationCancel && req.method === "POST") {
      const workspaceId = decodeURIComponent(conversationCancel[1]);
      const conversationId = decodeURIComponent(conversationCancel[2]);
      const result = await cancelEditorialConversationRun({ store, workspaceId, conversationId });
      return send(res, 200, result);
    }

    const conversationItem = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/conversations\/([^/]+)$/);
    if (conversationItem && req.method === "GET") {
      const workspaceId = decodeURIComponent(conversationItem[1]);
      const conversationId = decodeURIComponent(conversationItem[2]);
      return send(res, 200, { conversation: await getEditorialConversation(store, workspaceId, conversationId) });
    }

    const browserDestinationsPath = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/browser-destinations$/);
    if (browserDestinationsPath && req.method === "GET") {
      const workspaceId = decodeURIComponent(browserDestinationsPath[1]);
      const state = await store.read();
      return send(res, 200, { destinations: listBrowserDestinations(state, workspaceId) });
    }
    if (browserDestinationsPath && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(browserDestinationsPath[1]);
      const destination = await store.transact(state => registerBrowserDestination(state, { ...body, workspaceId }));
      return send(res, 201, { destination });
    }

    const browserSessionsPath = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/browser-sessions$/);
    if (browserSessionsPath && req.method === "GET") {
      const workspaceId = decodeURIComponent(browserSessionsPath[1]);
      const state = await store.read();
      return send(res, 200, { sessions: listBrowserSessions(state, workspaceId) });
    }
    if (browserSessionsPath && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(browserSessionsPath[1]);
      const state = await store.read();
      const destination = getBrowserDestination(state, workspaceId, body.destinationId);
      const response = await browserAgentRequest(`/internal/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
        method: "POST",
        body: { destinationId: destination.id, startUrl: destination.editorUrl, approvedHosts: destination.approvedHosts }
      });
      const session = await store.transact(current => saveBrowserSession(current, { ...response.session, workspaceId, destinationId: destination.id }));
      return send(res, 201, { session, limitations: ["The browser session is held in worker memory and ends when it expires or closes.", "The user must submit the reviewed article manually; no publish button is automated."] });
    }

    const browserSessionPath = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/browser-sessions\/([^/]+)(?:\/(screenshot|actions|fill-article))?$/);
    if (browserSessionPath) {
      const workspaceId = decodeURIComponent(browserSessionPath[1]);
      const sessionId = decodeURIComponent(browserSessionPath[2]);
      const action = browserSessionPath[3] || "";
      const state = await store.read();
      const savedSession = getBrowserSession(state, workspaceId, sessionId);
      const workerPath = `/internal/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`;
      if (!action && req.method === "GET") {
        const response = await browserAgentRequest(workerPath);
        const session = await store.transact(current => updateBrowserSession(current, workspaceId, sessionId, response.session));
        return send(res, 200, { session });
      }
      if (action === "screenshot" && req.method === "GET") {
        return send(res, 200, await browserAgentRequest(`${workerPath}/screenshot`));
      }
      if (action === "actions" && req.method === "POST") {
        const response = await browserAgentRequest(`${workerPath}/actions`, { method: "POST", body: await readJson(req) });
        const session = await store.transact(current => updateBrowserSession(current, workspaceId, sessionId, response.session));
        return send(res, 200, { session });
      }
      if (action === "fill-article" && req.method === "POST") {
        const body = await readJson(req);
        if (typeof body.taskId !== "string" || !body.taskId.trim() || body.taskId.length > 128) return send(res, 400, { error: "taskId is required" });
        const destination = getBrowserDestination(state, workspaceId, savedSession.destinationId);
        const approvedArticle = buildApprovedArticleForBrowser(state, { workspaceId, taskId: body.taskId, destination });
        const response = await browserAgentRequest(`${workerPath}/fill-article`, { method: "POST", body: approvedArticle });
        const session = await store.transact(current => updateBrowserSession(current, workspaceId, sessionId, response.session));
        return send(res, 200, { session, publishingEnabled: false, note: "Only the approved article text was inserted. Review the remote editor and submit manually if desired." });
      }
      if (!action && req.method === "DELETE") {
        let closeResult = { closed: true, alreadyClosed: true };
        try { closeResult = await browserAgentRequest(workerPath, { method: "DELETE" }); }
        catch (error) { if (error.status !== 404 && error.status !== 410) throw error; }
        await store.transact(current => removeBrowserSession(current, workspaceId, sessionId));
        return send(res, 200, closeResult);
      }
      return send(res, 405, { error: "Method not allowed" });
    }

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
      return send(res, 200, { limits: { ...DEFAULT_LIMITS, ...(state.limits || {}) } });
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

    const clientCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/clients$/);
    if (clientCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(clientCollection[1]);
      const state = await store.read();
      return send(res, 200, { clients: listEditorialClients(state, workspaceId) });
    }
    const brandCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/brands$/);
    if (brandCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(brandCollection[1]);
      const clientId = url.searchParams.get("clientId");
      const state = await store.read();
      return send(res, 200, { brands: listEditorialBrands(state, workspaceId, clientId) });
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

    const modelUsageRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/model-usage$/);
    if (modelUsageRoute && req.method === "GET") {
      const workspaceId = decodeURIComponent(modelUsageRoute[1]);
      const taskId = decodeURIComponent(modelUsageRoute[2]);
      const state = await store.read();
      const task = state.tasks?.[taskId];
      if (!task || task.workspaceId !== workspaceId || !task.article) return send(res, 404, { error: "Editorial task not found" });
      const attempts = (state.modelUsage || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
      const totalTokens = attempts.reduce((sum, item) => sum + (item.usage?.totalTokens || 0), 0);
      return send(res, 200, { attempts, usage: { requests: attempts.length, requestLimit: modelRequestsPerArticle, totalTokens, estimatedCostUsd: null } });
    }

    const draftGenerationRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/draft\/generate$/);
    if (draftGenerationRoute && req.method === "POST") {
      const workspaceId = decodeURIComponent(draftGenerationRoute[1]);
      const taskId = decodeURIComponent(draftGenerationRoute[2]);
      const result = await runEditorialDraftGeneration({
        store, provider: modelProvider, workspaceId, taskId, maxTokens: modelMaxOutputTokens, maxRequests: modelRequestsPerArticle
      });
      return send(res, 200, result);
    }

    const draftOriginalityRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/originality\/check-draft$/);
    if (draftOriginalityRoute && req.method === "POST") {
      const workspaceId = decodeURIComponent(draftOriginalityRoute[1]);
      const taskId = decodeURIComponent(draftOriginalityRoute[2]);
      const result = await store.transact(state => checkEditorialDraftOriginality(state, { workspaceId, taskId }));
      return send(res, 200, { result, scope: "current-draft-local-workspace-only" });
    }

    const editorialApprovalRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/approval$/);
    if (editorialApprovalRoute && req.method === "GET") {
      const workspaceId = decodeURIComponent(editorialApprovalRoute[1]);
      const taskId = decodeURIComponent(editorialApprovalRoute[2]);
      const state = await store.read();
      return send(res, 200, { approval: getEditorialApproval(state, workspaceId, taskId) });
    }
    if (editorialApprovalRoute && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(editorialApprovalRoute[1]);
      const taskId = decodeURIComponent(editorialApprovalRoute[2]);
      const result = await store.transact(state => recordEditorialReview(state, { ...body, workspaceId, taskId }));
      return send(res, 201, result);
    }

    const mediaReviewRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/media-review$/);
    if (mediaReviewRoute && req.method === "GET") {
      const workspaceId = decodeURIComponent(mediaReviewRoute[1]);
      const taskId = decodeURIComponent(mediaReviewRoute[2]);
      const state = await store.read();
      return send(res, 200, { mediaReview: getCurrentMediaReview(state, workspaceId, taskId) });
    }
    if (mediaReviewRoute && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(mediaReviewRoute[1]);
      const taskId = decodeURIComponent(mediaReviewRoute[2]);
      const review = await store.transact(state => recordMediaReview(state, { ...body, workspaceId, taskId }));
      return send(res, 201, { review, mediaReview: getCurrentMediaReview(await store.read(), workspaceId, taskId) });
    }

    const mediaCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/media$/);
    if (mediaCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(mediaCollection[1]);
      const taskId = decodeURIComponent(mediaCollection[2]);
      const state = await store.read();
      const assets = listMediaAssets(state, workspaceId, taskId).map(({ storageKey, ...asset }) => asset);
      return send(res, 200, { assets });
    }
    if (mediaCollection && req.method === "POST") {
      const asset = await createMediaAsset({
        req,
        store,
        workspaceId: decodeURIComponent(mediaCollection[1]),
        taskId: decodeURIComponent(mediaCollection[2]),
        mediaDir
      });
      const { storageKey, ...publicAsset } = asset;
      return send(res, 201, { asset: publicAsset });
    }
    const mediaFileRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/media\/([^/]+)\/file$/);
    if (mediaFileRoute && req.method === "GET") {
      const { asset, filePath } = await resolveMediaAssetFile({
        store, workspaceId: decodeURIComponent(mediaFileRoute[1]), taskId: decodeURIComponent(mediaFileRoute[2]),
        assetId: decodeURIComponent(mediaFileRoute[3]), mediaDir
      });
      res.writeHead(200, {
        "content-type": asset.mimeType,
        "content-length": asset.sizeBytes,
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
        "cache-control": "no-store"
      });
      const stream = createReadStream(filePath);
      stream.on("error", () => { if (!res.headersSent) send(res, 404, { error: "Media file is missing" }); else res.destroy(); });
      return stream.pipe(res);
    }
    const mediaItemRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/media\/([^/]+)$/);
    if (mediaItemRoute && req.method === "DELETE") {
      const result = await deleteMediaAsset({
        store, workspaceId: decodeURIComponent(mediaItemRoute[1]), taskId: decodeURIComponent(mediaItemRoute[2]),
        assetId: decodeURIComponent(mediaItemRoute[3]), mediaDir
      });
      return send(res, 200, result);
    }

    const geoBriefRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/geo-brief$/);
    if (geoBriefRoute && req.method === "GET") {
      const state = await store.read();
      return send(res, 200, getGeoBrief(state, decodeURIComponent(geoBriefRoute[1]), decodeURIComponent(geoBriefRoute[2])));
    }
    if (geoBriefRoute && req.method === "PUT") {
      const body = await readJson(req);
      const result = await store.transact(state => updateGeoBrief(state, {
        ...body,
        workspaceId: decodeURIComponent(geoBriefRoute[1]),
        taskId: decodeURIComponent(geoBriefRoute[2])
      }));
      return send(res, 200, result);
    }
    const geoReadinessRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/geo-readiness$/);
    if (geoReadinessRoute && req.method === "GET") {
      const state = await store.read();
      return send(res, 200, getGeoReadiness(state, decodeURIComponent(geoReadinessRoute[1]), decodeURIComponent(geoReadinessRoute[2])));
    }

    const platformVariantsRoute = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/platform-variants$/);
    if (platformVariantsRoute && req.method === "GET") {
      const workspaceId = decodeURIComponent(platformVariantsRoute[1]);
      const taskId = decodeURIComponent(platformVariantsRoute[2]);
      const state = await store.read();
      const task = state.tasks?.[taskId];
      if (!task || task.workspaceId !== workspaceId || !task.article) return send(res, 404, { error: "Editorial task not found" });
      return send(res, 200, { variants: listPlatformVariants(state, workspaceId, taskId), publishingEnabled: false });
    }
    if (platformVariantsRoute && req.method === "POST") {
      const body = await readJson(req);
      const result = await generatePlatformVariant({
        store,
        provider: platformContentProvider,
        workspaceId: decodeURIComponent(platformVariantsRoute[1]),
        taskId: decodeURIComponent(platformVariantsRoute[2]),
        platformId: body.platformId,
        placement: body.placement || "",
        mediaAssetIds: body.mediaAssetIds || []
      });
      return send(res, 201, { ...result, publishingEnabled: false });
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

    const scrapeCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/research\/scrapes$/);
    if (scrapeCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(scrapeCollection[1]);
      const taskId = decodeURIComponent(scrapeCollection[2]);
      const state = await store.read();
      const task = state.tasks?.[taskId];
      if (!task || task.workspaceId !== workspaceId || !task.article) return send(res, 404, { error: "Editorial task not found" });
      return send(res, 200, {
        scrapes: (state.researchScrapes || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId),
        usage: task.usage || { scrape: 0 },
        limit: { ...DEFAULT_LIMITS, ...(state.limits || {}) }.scrapesPerArticle
      });
    }
    if (scrapeCollection && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(scrapeCollection[1]);
      const taskId = decodeURIComponent(scrapeCollection[2]);
      const headerId = req.headers["idempotency-key"];
      const operationId = typeof headerId === "string" ? headerId : body.operationId;
      const outcome = await runMeteredResearchScrape({
        store, provider: firecrawlProvider, workspaceId, taskId, input: body, operationId
      });
      if (!outcome.allowed) return send(res, 429, { error: "Per-article Firecrawl scrape limit reached", quota: outcome.quota });
      return send(res, 200, outcome);
    }

    const inspectionCollection = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/tasks\/([^/]+)\/research\/inspections$/);
    if (inspectionCollection && req.method === "GET") {
      const workspaceId = decodeURIComponent(inspectionCollection[1]);
      const taskId = decodeURIComponent(inspectionCollection[2]);
      const state = await store.read();
      const task = state.tasks?.[taskId];
      if (!task || task.workspaceId !== workspaceId || !task.article) return send(res, 404, { error: "Editorial task not found" });
      return send(res, 200, {
        inspections: (state.researchInspections || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId),
        usage: task.usage || { inspect: 0 },
        limit: { ...DEFAULT_LIMITS, ...(state.limits || {}) }.inspectionsPerArticle
      });
    }
    if (inspectionCollection && req.method === "POST") {
      const body = await readJson(req);
      const workspaceId = decodeURIComponent(inspectionCollection[1]);
      const taskId = decodeURIComponent(inspectionCollection[2]);
      const headerId = req.headers["idempotency-key"];
      const operationId = typeof headerId === "string" ? headerId : body.operationId;
      const outcome = await runResearchInspection({
        store, workspaceId, taskId, sourceId: body.sourceId, operationId
      });
      if (!outcome.allowed) return send(res, 429, { error: "Per-article inspection limit reached", quota: outcome.quota });
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
  console.log(`Supabase: disabled | Firecrawl: ${firecrawlProvider ? "enabled" : "disabled"} | Persistence: local JSON`);
});
