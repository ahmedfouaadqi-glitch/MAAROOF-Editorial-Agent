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

**Important:** Registering a URL does not fetch, crawl, parse, or verify the remote page. No Firecrawl or other crawler is present.

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
