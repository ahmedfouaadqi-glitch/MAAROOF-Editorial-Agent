# Standalone Editorial API

Base URL: `http://127.0.0.1:8787` by default. All `/api/v1/*` routes require `Authorization: Bearer <ADMIN_API_TOKEN>`. `/health` is public.

## Health
- `GET /health` — service status and explicitly disabled integrations.

## Admin research limits
- `GET /api/v1/admin/research-limits` — read saved limits.
- `PUT /api/v1/admin/research-limits` — replace limits.

Request body:
```json
{
  "limits": {
    "sourceUrlsPerArticle": 3,
    "scrapesPerArticle": 3,
    "searchesPerArticle": 5,
    "inspectionsPerArticle": 5
  }
}
```

Each limit must be an integer from 0 through 10000.

## Editorial articles
- `POST /api/v1/workspaces/:workspaceId/articles` — create an intake task.
- `GET /api/v1/workspaces/:workspaceId/articles` — list tasks in that workspace.
- `PUT /api/v1/workspaces/:workspaceId/articles/:taskId/stage` — advance exactly one stage in the defined editorial sequence.

Example create body:
```json
{
  "topic": "Generative search visibility for retail brands",
  "language": "en",
  "objective": "analysis",
  "targetPlatformId": "wordpress"
}
```

## Source references (manual only)
- `POST /api/v1/sources` — register a user-supplied HTTP(S) URL, title, and notes. The operation reserves one source URL against that article's quota and stores the reference atomically.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/sources` — list registered references.

POST body example:
```json
{
  "workspaceId": "workspace-id",
  "taskId": "article-task-id",
  "url": "https://example.org/research",
  "title": "Research reference",
  "notes": "Relevant section and claim to review"
}
```

**Important:** Registering a URL manually does not fetch or verify it. The separate Firecrawl scrape endpoint performs bounded retrieval only when the server has a valid FIRECRAWL_API_KEY. Retrieved content remains unverified.

## Research quota reservations
- `POST /api/v1/tasks/:taskId/research-reservations` — reserve one or more `search` or `inspect` units. `source` units are reserved automatically when a source URL is registered.
- `POST /api/v1/tasks/:taskId/research-reservations/:reservationId/commit` — mark a successful operation committed.
- `POST /api/v1/tasks/:taskId/research-reservations/:reservationId/release` — release a failed operation reservation.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/research-usage` — read usage and reservation states.

Reservation body:
```json
{
  "workspaceId": "workspace-id",
  "operation": "search",
  "units": 1,
  "reservationId": "unique-operation-id"
}
```

Retries using the same reservation ID and same operation/units are idempotent. Reusing the ID with different parameters returns a conflict. Search/inspection reservations are quota accounting only: no live provider is connected to execute those operations.

## Operational limitations
- JSON persistence is atomic and serialized within one Node process. Do not run multiple API instances against the same data file.
- The shared admin bearer token is a temporary operator gate, not production identity authentication.
- Workspace IDs are record-scoped but must be bound to authenticated users before public multi-tenant deployment.
- The API binds to loopback by default. Remote binding is rejected unless `API_ALLOW_REMOTE=true`, a strong `ADMIN_API_TOKEN` is configured, and a trusted TLS proxy/firewall protects it.
- Configure `CORS_ORIGIN`, `HOST`, `API_ALLOW_REMOTE`, `DATA_FILE`, and `ADMIN_API_TOKEN` through environment variables.

## Editorial evidence and claims
- `POST /api/v1/claims` — register a factual/editorial claim for an article and optionally link it to source IDs.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/claims` — list claims and return deterministic source-link coverage.

Claim body:
```json
{
  "workspaceId": "workspace-id",
  "taskId": "article-task-id",
  "text": "The company reported annual revenue growth.",
  "sourceIds": ["registered-source-id"]
}
```

A source can only be linked when it belongs to the same workspace and article. The API labels a linked claim as `source-linked-unverified`; this means only that a reference was attached. It does not mean the source was opened, checked, or proven to support the claim. Coverage is the percentage of claims with at least one linked source, not an accuracy score.

## Deterministic originality baseline
- `POST /api/v1/originality/check` — compare submitted text with saved article drafts, saved social drafts, and eligible prior checks in the same workspace.
- `GET /api/v1/workspaces/:workspaceId/clients` — list client identities used by article tasks.
- `GET /api/v1/workspaces/:workspaceId/brands` — list brand identities; optionally filter with `?clientId=...`.

`POST /api/v1/workspaces/:workspaceId/articles` accepts optional `clientName` and `brandName`. Names are created or reused within the workspace after Unicode normalization, case folding, and whitespace normalization; a brand is associated with the selected client, or is standalone when no client is supplied. The created task stores both IDs and display names. This registry supports content grouping only; it is not a user-authentication or authorization boundary.

Body:
```json
{
  "workspaceId": "workspace-id",
  "taskId": "article-task-id",
  "text": "At least 30 characters of draft text..."
}
```

The baseline normalizes Unicode, common Arabic letter variants, diacritics, punctuation, and whitespace, then reports exact normalized matches and token-set Jaccard overlaps (near-match threshold 0.82; near matches require at least eight normalized tokens). It includes current saved article drafts and saved social drafts within the same client; sibling brands under that client are compared and identified separately. Standalone brands are compared to the same brand. Legacy records without identity are compared only with other unassigned records, and may be surfaced as `legacy-unassigned` when a task has an identity. Content assigned to another client is excluded. Prior originality-check text is included only when that task has no current saved article draft. The response identifies the matched record type, task, title, platform, identity relationship, and similarity for human review. Each check stores its normalized text, fingerprint, and match summary in the local JSON store. Current article content and its own social variants are excluded when checking that article.

When a new social variant is created, it is checked against other article drafts and saved social variants for the same client (including sibling brands), or the same standalone brand; legacy unassigned items are also surfaced separately. Its source article is excluded. A match blocks saving and shows the matched content type/title and identity relationship. This remains a deterministic lexical heuristic, not semantic similarity or plagiarism detection. It does not compare separate workspaces or different clients, detect translated paraphrases, or search external/unrecorded content. Topic overlap alone should not be treated as duplication; review the angle and claims. Do not treat `no-match-found` as proof of originality.


## Entity intelligence registry
- `POST /api/v1/entities` — register a typed entity with a canonical name, optional aliases, and a required disambiguation note.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/entities` — list article-scoped entities and their linked claim IDs.
- `POST /api/v1/entities/scan` — match registered aliases against claims in the same article and create idempotent entity-to-claim links.
- `POST /api/v1/entity-relationships` — register a directed relationship between two article-scoped entities, optionally linked to supporting claim IDs.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/entity-relationships` — list registered relationships.

Supported entity types: `person`, `organization`, `place`, `product`, `event`, `concept`, `unknown`. Canonical names and aliases are normalized for duplicate detection within the same article; separate articles may curate their own entity records. Entity relationships must reference two distinct entities and any supporting claims must belong to the same workspace and article.

The current scanner is deliberately limited to exact normalized matches against aliases entered by an operator. It does not perform named-entity recognition, discover new entities, resolve ambiguous identities across sources, infer relations from prose, or establish that a claim supports a relationship. Relationship evidence states remain `claim-linked-unverified` or `unsubstantiated`.


## Live research search provider boundary
A provider-neutral contract is implemented in `server/research-provider.mjs`. It validates bounded queries, normalizes and deduplicates HTTP(S) result URLs, and labels every result `search-result-unverified`. Firecrawl v2 and Brave are optional server-side providers. When no provider is enabled, live search fails closed. Search results are discovery leads and must be opened and assessed before they can support a claim.

## Editorial research and source assessment
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/research` — return article-scoped source assessments, evidence excerpts, and claim conflict summaries.
- `PUT /api/v1/sources/assessment` — manually record source author, publisher, type, publication/update dates, effective period, jurisdiction, methodology, quality rating, and rationale.
- `POST /api/v1/research/evidence` — manually record an excerpt from a registered source against a claim, with stance (`supports`, `contradicts`, `contextualizes`, or `unclear`) and a page/paragraph locator.

Metadata completeness is the proportion of seven descriptive fields supplied; it is not a source-trust score. Quality ratings are explicit human editorial judgments and require a written rationale. Dates describe the source or the period in which its information is effective; they are not inferred from a crawl. Conflicting evidence is flagged when an editor has recorded both supporting and contradicting excerpts for the same claim. The system does not decide which side is correct.

All excerpts and source assessments are manually entered. No URL is fetched, no remote page is parsed, and no claim is independently verified by these endpoints. Evidence records remain `manually-transcribed-unverified`.


## AI visibility evidence (admin)

All endpoints require the configured admin bearer token.

### List observations

`GET /api/v1/admin/ai-visibility?workspaceId=main-workspace`

Returns workspace-scoped events, summary counters, and limitations. Verified indexing/citation/training counters include only verified events. Crawler fetch counts are observations and do not imply index inclusion, citation, or training.

### Record an observation

`POST /api/v1/admin/ai-visibility/events`

Example body:

```json
{
  "workspaceId": "main-workspace",
  "articleId": "optional-article-id",
  "url": "https://example.com/article",
  "eventType": "citation_verified",
  "provider": "OpenAI",
  "bot": "OAI-SearchBot",
  "source": "manual",
  "observedAt": "2026-11-04T07:00:00.000Z",
  "evidenceUrl": "https://example.com/evidence",
  "evidenceNote": "Captured answer visibly links the article URL",
  "verified": true,
  "verificationMethod": "admin_manual_review"
}
```

Supported event types: `crawler_fetch`, `search_index_verified`, `citation_verified`, `training_attestation`, `referral_visit`.

Verified indexing, citation, and training events require both `evidenceUrl` and `evidenceNote`. Training use must never be inferred from crawler access. The current API records manual evidence; automated access-log, Search Console, Bing Webmaster, and AI-answer integrations are not connected.



## Live article research search (optional server integration)
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/research/searches` — execute one quota-metered query when the optional search provider is configured.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/research/searches` — read stored search runs for the same task.

The search provider is selected on the server. Set `RESEARCH_SEARCH_PROVIDER=firecrawl` with `FIRECRAWL_API_KEY` to use Firecrawl Search, or `RESEARCH_SEARCH_PROVIDER=brave` with `BRAVE_SEARCH_API_KEY` to use Brave. The key is never sent to the browser. Language and country parameters are normalized by the provider adapter; country context is a search hint, not a strict country-only filter.

Each provider attempt consumes one per-article search quota. Provider failures are counted conservatively because a timeout may occur after the provider receives the request. Search results are saved with retrieval time and provider provenance, normalized to HTTP(S), and labeled `search-result-unverified`. They are discovery leads only. The remote page is not fetched or verified. The UI can register a result as an article source, which still remains a manual reference.

Search remains disabled unless a supported provider is configured server-side. CI uses mocked providers and performs no live or paid requests. Provider plans and pricing can change; check the provider dashboard before enabling a live integration.

## Deferred model-assisted article drafting

- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/draft/generate` — explicitly request a model-assisted draft while the article is in the `drafting` stage.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/model-usage` — list per-article generation attempts and token counts.

Article-writing model use is deferred by product decision. The model provider is hard-disabled in the current server build; the generation endpoint returns a service-unavailable response and does not call a model, regardless of environment flags. The existing provider code is retained only as a future extension point. No model key or paid generation call is required or used in this phase.

Generation requires an outline, assessed sources, claims linked to sources, and manually recorded evidence excerpts. The model receives only those records; it does not fetch remote pages. Every generated section must return evidence IDs and claim IDs already present in the article, and the service rejects unknown or mismatched references. Model attempts are reserved atomically before the outbound call and retained as usage records on success, provider failure, invalid output, or stale-draft conflict. Token usage is stored when returned. Cost remains null because provider/model pricing is not configured by this service.

Model generation is invoked only by an explicit user action. Tests use mocked providers and do not make live or paid requests. Generated text is still an unverified draft and requires source review, originality checking, media review, and human editorial approval. No model is selected or enabled by default.

## Editorial outline and draft workspace
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/draft` — create or regenerate an objective-based structural outline.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/draft` — retrieve the saved outline/draft.
- `PUT /api/v1/workspaces/:workspaceId/tasks/:taskId/draft` — save editor-authored title, metadata, section headings, and section body text.

The outline generator is deterministic and creates section prompts only. It does not generate factual prose, perform live research, or call an LLM. All draft operations verify that the task belongs to the requested workspace.

## GEO editorial brief and readiness checklist

- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/geo-brief` — read the saved intent, query phrases, questions, entity selection, and current checklist.
- `PUT /api/v1/workspaces/:workspaceId/tasks/:taskId/geo-brief` — save the editor-authored brief on an existing article draft.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/geo-readiness` — recompute descriptive phrase, question, entity, angle, and source-freshness checks from saved records.

The `PUT` body accepts `intent` (`informational`, `commercial`, `transactional`, `navigational`, or `local`), `primaryQuery`, up to 12 `supportingTerms`, up to 12 `targetQuestions` (`question`, optional `sectionId`, and up to 8 article-scoped `evidenceIds` each), and up to 20 article-scoped `targetEntityIds`. Every selected section, evidence record, and entity is validated against the same workspace and article. Question-to-section mapping, recorded excerpts, and registered entities are editor supplied; no keyword research, entity discovery, evidence verification, or semantic fact check is performed.

Readiness is a checklist (`incomplete` or `ready-for-editor-review`), not a numerical score. Exact phrase occurrence counts are descriptive only; missing phrases are not an instruction to repeat them. The response reports whether questions map to non-empty sections with supporting excerpts, whether selected entities are mentioned and linked to recorded claim evidence, and whether source dates are present. It does not verify that an answer is correct, that a source is current, or that a page will rank or be cited. If an article-generation or platform-adaptation provider is later enabled, the saved brief is passed as editorial guidance with explicit no-stuffing/no-invention instructions. Article prose generation remains disabled by default.

## Platform-native social drafts

- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/platform-variants` — list saved platform-specific drafts.
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/platform-variants` — create one distinct draft from the saved article for a selected platform.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/media` — list media metadata scoped to the same workspace and article.
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/media` — stream one binary image or video file into local media storage.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/media/:assetId/file` — stream an authenticated, scoped media file for preview.
- `DELETE /api/v1/workspaces/:workspaceId/tasks/:taskId/media/:assetId` — remove its metadata and local file.

POST body:
```json
{
  "platformId": "linkedin",
  "placement": "feed post"
}
```

Supported IDs: `linkedin`, `facebook`, `instagram`, `x`, `threads`, `tiktok`, `youtube`, and `pinterest`. Drafts are stored with `draft-only` status, retain their source-draft timestamp and require human review. Before storage, normalized exact/near matching checks saved social drafts and other article drafts for the same client (including sibling brands) or the same standalone brand; legacy unassigned items are also surfaced. It excludes the source article itself and different clients. This is only a heuristic; it is not semantic or cross-language duplicate detection and does not check external content or other workspaces. The request may include up to 12 `mediaAssetIds` selected by the user. The model receives only their descriptions and may return matching IDs in `selectedMediaIds`; file bytes are never sent. A saved GEO brief may guide platform wording by intent, target questions and selected entities, but the model is instructed not to stuff phrases or invent claims. The response explicitly returns `publishingEnabled: false`; this endpoint does not connect an account or publish anything. Video-oriented variants can include a script, on-screen text, shot plan and media brief.

### Media upload contract

Send the raw file bytes as the request body with `Content-Type` set to `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, or `video/webm`; pass `X-File-Name` and `X-Media-Description` as URL-encoded UTF-8 header values. The description is required for both images (used as alt text) and videos (used as a caption/context). Images are limited to 10 MiB each, videos to 50 MiB each, and the combined local storage quota for media assets and conversation attachments is 250 MiB. The server validates the declared MIME against a file signature, generates the actual disk name, stores files outside the web root with restrictive permissions, and returns no storage path. SVG and other unlisted formats are rejected.

Files and metadata are stored locally (`MEDIA_DIR`, default `./data/media`) for this prototype; this is not durable object storage, antivirus scanning, EXIF removal, semantic image recognition, or production multi-instance storage. Supported image headers receive deterministic metadata-only analysis for pixel dimensions, aspect ratio, orientation, and coarse placement hints; low-resolution or unreadable metadata produces warnings. Video duration, frame size, codec, audio, subtitles, and thumbnails are not inspected. The analyzer does not infer image subjects, generate factual alt text, judge visual quality, or verify usage rights. The shared admin bearer token remains an interim gate, so workspace path scoping is not a substitute for real user/workspace authorization. Review usage rights before publication. No file bytes are sent to any model or MAAROOF AI.

Generation is off by default. To enable it intentionally, set `PLATFORM_CONTENT_GENERATION_ENABLED=true` and configure `MODEL_API_BASE_URL`, `MODEL_API_KEY`, and `MODEL_NAME` on the server. This invokes the configured OpenAI-compatible provider only on an explicit POST request and may incur provider charges. Tests use mocked providers. This capability is independent of MAAROOF AI; no MAAROOF AI API, database, or workspace is accessed.

## Draft-bound review, media rights, and final approval

- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/originality/check-draft` — record a local originality result for the saved draft during the `originality-review` stage.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/media-review` — read the latest media decision and whether it still matches the saved draft.
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/media-review` — record `approved`, `not-required`, or `changes-requested` during `media-review`.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/approval` — return blockers, warnings, evidence counts, and current-version review state.
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/approval` — record `approved`, `changes-requested`, or `rejected` with reviewer and rationale during `editorial-approval`.

Editorial and media decisions store a SHA-256 fingerprint of normalized draft text. Any subsequent edit makes the recorded decision stale for the new version. The current approval gate requires a complete draft, source references, linked claims and manual evidence excerpts, assessed sources, a current-draft local originality check, and a current media decision. The final `ready-to-publish` transition requires explicit human approval for that exact draft version.

An approved media record requires an HTTP(S) asset reference, creator, license, attribution, alt text, and a human confirmation of usage rights. `not-required` explicitly records that the article has no media. This is not a file upload or independent license verification. A local originality no-match result is not proof of originality. Reaching `ready-to-publish` does not publish the article.

## Magazine pitch and submission tracking (manual handoff)

- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/magazine-submissions` — create a local pitch record.
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/magazine-submissions` — list pitch/submission records for that article.
- `PUT /api/v1/workspaces/:workspaceId/tasks/:taskId/magazine-submissions/:submissionId/status` — record an editorial status transition and optional human-entered note.

Create body:
```json
{
  "publicationId": "publication-id-from-registry",
  "proposedTitle": "Proposed article title",
  "pitch": "Why this story matters to this publication and its readers.",
  "authorName": "Author name",
  "exclusivityConfirmed": false
}
```

Status update body:
```json
{ "nextStatus": "approved", "note": "Reviewed by the author." }
```

Statuses: `draft`, `approved`, `submitted`, `editor-replied`, `accepted`, `rejected`, `published`, `withdrawn`. A submission can only be recorded after explicit approval and an exclusivity confirmation. Acceptance and publication are separate states. The API only records operator-reported actions; it does not send pitches, upload manuscripts, contact editors, or verify publication externally. A `published` status is a manual record, not independent proof of a live URL.

## Browser-assisted article handoff (no automated publish)

All routes below require the admin bearer token and are scoped by `workspaceId`:
- The frontend opens this workflow as a side drawer in the same application frame (full-screen on phones); it preserves the current page and does not turn the session into a publishing adapter.
- `GET /api/v1/workspaces/:workspaceId/browser-destinations` — list declared destination profiles.
- `POST /api/v1/workspaces/:workspaceId/browser-destinations` — register a destination with `name`, HTTPS `homepage`, optional HTTPS `editorUrl`, optional additional `approvedHosts`, optional CSS `titleSelector` and `bodySelector` (provide both together only when automatic text insertion is desired), plus `authorityConfirmed: true` and `policyReviewed: true`. The homepage host and its subdomains are allowed automatically; add a separate editor or sign-in domain explicitly. These are operator declarations, not independent verification.
- `GET /api/v1/workspaces/:workspaceId/browser-sessions` — list metadata for recorded worker sessions; cookies and browser contexts are never included.
- `POST /api/v1/workspaces/:workspaceId/browser-sessions` with `{ "destinationId": "..." }` — open the configured editor/login page in the private browser worker.
- `GET /api/v1/workspaces/:workspaceId/browser-sessions/:sessionId` — read session state; `GET .../:sessionId/screenshot` returns a no-store base64 JPEG screenshot.
- `POST .../:sessionId/actions` — perform a bounded user-directed browser action (`click`, `type`, `press`, `scroll`, `fill`, or approved-host `navigate`).
- `POST .../:sessionId/fill-article` with `{ "taskId": "..." }` — insert only the article title/body when the task is `ready-to-publish`, its current draft has a valid human editorial approval, and both destination selectors are configured.
- `DELETE /api/v1/workspaces/:workspaceId/browser-sessions/:sessionId` — close the session and clear its in-memory browser context.

Run `npm run browser:install` once to install Chromium. Configure a dedicated random 32+ character `BROWSER_AGENT_TOKEN` in both the API and worker environments, keep the worker on loopback (`BROWSER_AGENT_HOST=127.0.0.1`), then run `npm run browser:worker` beside `npm run server`. The worker rejects browser-origin/CORS requests; remote binding requires explicit `BROWSER_AGENT_ALLOW_REMOTE=true` and a trusted TLS reverse proxy plus network filtering. The API proxies to the worker and never returns its token. Sessions/cookies live only in worker memory for at most one hour, limited to two per workspace and four active sessions total; restarting the worker ends them. The API allows 240 reads and 60 writes per IP per minute; the worker applies the same read/write limits. Both counters are in memory and reset on restart. Users sign in and handle MFA/CAPTCHA themselves. Typed values pass through the authenticated API and worker in memory but are not persisted by this feature. Serve the frontend and API over HTTPS outside local development. The prototype does not attach uploaded media, click Save/Submit/Publish automatically, implement a verified platform adapter, or verify the public result URL. A user-controlled click remains possible inside the remote session; the app itself does not trigger publication.


## Firecrawl search, scraping, and source inspection

### Search
- POST /api/v1/workspaces/:workspaceId/tasks/:taskId/research/searches — execute one quota-metered query.
- GET /api/v1/workspaces/:workspaceId/tasks/:taskId/research/searches — read stored search runs.

Set RESEARCH_SEARCH_PROVIDER=firecrawl with FIRECRAWL_API_KEY to use Firecrawl Search, or RESEARCH_SEARCH_PROVIDER=brave with BRAVE_SEARCH_API_KEY to use Brave. Keys are server-side only. Each provider attempt consumes one search quota (default 5 per article). Results are labelled search-result-unverified and are only discovery leads. The search itself does not fetch the page content.

### Scraping
- POST /api/v1/workspaces/:workspaceId/tasks/:taskId/research/scrapes — retrieve one explicitly selected URL and store extracted Markdown as an unverified source.
- GET /api/v1/workspaces/:workspaceId/tasks/:taskId/research/scrapes — list stored scrape runs.

Set FIRECRAWL_API_KEY on the server. Scraping fails closed without a key. The default quota is 3 page URLs per article and can be changed in the admin research settings. The provider uses Firecrawl v2, requests Markdown and main content only, caps stored Markdown at 120,000 characters, and rejects non-HTTP(S), credentialed, local/internal-hostname and literal-IP URL targets. This validation is not a complete DNS-rebinding defense; further destination controls and provider-side protections remain necessary.

A successful scrape means content was retrieved, not that it is accurate, original, current or relevant. Retrieved content remains scraped-content-unverified until claims are assessed and supported by evidence. Tests use mocked providers and make no live Firecrawl requests.

### Structure inspection
- POST /api/v1/workspaces/:workspaceId/tasks/:taskId/research/inspections — run a deterministic structure inspection against an already scraped source ID.
- GET /api/v1/workspaces/:workspaceId/tasks/:taskId/research/inspections — list inspections.

The default quota is 5 inspections per article. An inspection reports word count, Markdown heading count, inline link count and structural warnings. It is a local deterministic check; it does not consume a Firecrawl request and does not establish source credibility or factual accuracy.


## Conversation library and run controls

- `GET /api/v1/workspaces/:workspaceId/library` — list saved conversation drafts for the requested workspace. Results are derived from persisted conversation drafts and are filtered by workspace ownership.
- `POST /api/v1/workspaces/:workspaceId/conversations/:conversationId/cancel` — cooperatively cancel the queued/running editorial generation for that conversation. The server aborts the in-flight model request when it is active and records the run as cancelled. It does not undo already completed external actions; the conversation runner performs no publishing.


## Workspaces and chat-first workflow

- `GET /api/v1/workspaces?locale=ar|en` — list registered workspaces and localize the built-in default workspace name.
- `POST /api/v1/workspaces` with `{ "name": "Brand newsroom" }` — create a workspace; the name is normalized and checked for duplicates.
- `GET /api/v1/editorial-targets` — return the chat target catalog with bilingual descriptions, scope, style summary, format list, and availability.
- `GET /api/v1/workspaces/:workspaceId/conversations` — list the workspace's history; `POST` to the same route creates a conversation with `targetId`, `language`, and optional client/brand identity.
- `POST /api/v1/workspaces/:workspaceId/conversations/:conversationId/messages` — enqueue an editorial run after validating message text, target, attachments and idempotency ID. Progress is persisted in the conversation record.
- `POST /api/v1/workspaces/:workspaceId/conversations/:conversationId/attachments` — accept an image (10 MiB), video (50 MiB), PDF/DOCX (15 MiB), or TXT/Markdown (2 MiB) attachment for that conversation, subject to the shared 250 MiB local quota. DOCX ZIP metadata is checked for at most 256 entries, 25 MiB per expanded entry, and 50 MiB total expansion; encrypted archives, ZIP64, and path traversal are rejected before text extraction. Download and deletion endpoints are scoped to both conversation and workspace.

A new conversation may include `brandProfile` alongside `brandName`:

```json
{
  "targetId": "linkedin",
  "language": "en",
  "clientName": "Example Client",
  "brandName": "Example Brand",
  "brandProfile": {
    "voice": "Clear, calm and evidence-led",
    "audience": "Regional startup founders",
    "approvedFacts": "Company facts and provenance for review",
    "avoid": "Terms or claims to avoid"
  }
}
```

The profile is stored on the brand identity within that workspace; each field has a server-side character limit. `GET /api/v1/workspaces/:workspaceId/brands` returns the associated records and profile so the UI can reuse them. Profile guidance changes writing context only: the server does not treat the text as independently verified evidence. If no brand name or brand ID is supplied, a non-empty profile is rejected.

The chat catalog and the older `/platform-variants` endpoint have different purposes: the former selects conversation-generation targets (25 bilingual profiles in this snapshot), while `/platform-variants` remains the legacy article-repurposing API with its narrower set of eight identifiers. Neither registry proves that a destination is connected or that publishing works. All routes still use the shared temporary admin bearer token; a workspace ID is not user membership authorization.


## Skill routing for conversation runs

Skill selection is an in-process capability of `server/editorial-skills.mjs`; it does not expose a separate catalog API. The source library is the user-supplied consolidated skill file, split into 70 source definitions (69 unique skill IDs, with two Humanizer variants kept distinct) under `skills/library/`, with metadata and bilingual intent triggers in `skills/catalog.json`.

Every queued run stores `selectedSkills` and `skillRoutingVersion` in `activeRun.metadata`. The resulting assistant message and saved conversation draft also include `selectedSkills`, each with `id`, `skillId`, optional `variant`, `category`, `runtimeStatus`, localized `purpose`, and a localized routing `reason`. The router loads only selected skill instructions and caps their combined source guidance at 12,000 characters. A short follow-up may retain the last assistant result's selected skills; if that result was eligible for publication, its destination/GEO context and human handoff eligibility are retained unless the current request explicitly marks the output as non-publication. Competing list/comparison/rewrite templates are mutually gated.

`runtimeStatus` is one of `can_run_now`, `guidance_only`, or `blocked_on_integration`. These are app-side capability labels, not Manus tool access. Selected source instructions are untrusted task guidance and cannot elevate into system instructions, authorize external API calls, or cause unconfigured searches/media generation to be claimed as complete.

`result.handoffEligible` is `true` only when the user explicitly requested a publishable article/post/script/other supported target content. For non-publication documents such as a PRD, plan, or analysis, the requested structure is placed in the Markdown `draft.body`, GEO is marked not applicable, and the browser handoff is withheld even when a destination was selected as workspace context. When eligible, handoff remains user initiated and stops before any publish action.
