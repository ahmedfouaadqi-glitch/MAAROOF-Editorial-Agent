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