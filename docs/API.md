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
- Configure `CORS_ORIGIN`, `HOST`, `DATA_FILE`, and `ADMIN_API_TOKEN` through environment variables.

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
- `POST /api/v1/originality/check` — compare submitted text with prior text checks from other articles in the same workspace.

Body:
```json
{
  "workspaceId": "workspace-id",
  "taskId": "article-task-id",
  "text": "At least 30 characters of draft text..."
}
```

The baseline normalizes Unicode, common Arabic letter variants, diacritics, punctuation, and whitespace, then checks SHA-256 exact matches and token-set Jaccard overlap (near-match threshold 0.82). It stores only the normalized text and fingerprint in the local JSON store so later checks can compare against it. This is a deterministic heuristic, not semantic similarity or plagiarism detection. It does not check external websites, translated paraphrases, or text never submitted to this endpoint. Do not treat `no-match-found` as proof of originality.


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

The current adapter is Brave Web Search. Configure `RESEARCH_SEARCH_PROVIDER=brave` and `BRAVE_SEARCH_API_KEY` on the server only. The key is never sent to the browser. The service follows Brave's documented POST endpoint, sends the token in `X-Subscription-Token`, and supports Arabic/English query language. The selected two-letter country is sent as the `x-loc-country` request context header; it is a location hint, not a strict country-only filter. The query itself may include the target market to refine it.

Each provider attempt consumes one per-article search quota. Provider failures are counted conservatively because a timeout may occur after the provider receives the request. Search results are saved with retrieval time and provider provenance, normalized to HTTP(S), and labeled `search-result-unverified`. They are discovery leads only. The remote page is not fetched or verified. The UI can register a result as an article source, which still remains a manual reference.

The adapter is disabled by default. No credentials, live requests, or paid API calls are part of CI. Provider plans and pricing can change; check the provider dashboard before enabling it.

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

