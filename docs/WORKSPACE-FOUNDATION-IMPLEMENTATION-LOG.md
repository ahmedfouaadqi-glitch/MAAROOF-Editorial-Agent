# Workspace Foundation Implementation Log — 2026-11-05

## Accepted product decision

Option 1 selected: one administrator manages multiple isolated workspaces. The existing `ADMIN_API_TOKEN` remains the single administrator authentication gate. No multi-user account, membership, invitation, or role system is being introduced.

Decision record: `docs/ARCHITECTURE-DECISION-SINGLE-ADMIN.md`.

## Changes added to PR #10

### Legacy ownership migration
- Added `migrateLegacyWorkspaceOwnership` in `server/store.mjs`.
- Unscoped legacy conversations are assigned to `main-workspace`.
- An unscoped attachment inherits the workspace of its linked conversation only when exactly one conversation matches its `conversationId`.
- Existing non-empty workspace IDs are preserved.
- Orphaned or ambiguous attachments remain unassigned; no ownership is guessed.
- Migration runs during store initialization and persists only when it changes state.

### Workspace lifecycle
- Added `restoreWorkspace`.
- Added `GET /api/v1/workspaces?includeArchived=true`.
- Added `POST /api/v1/workspaces/:workspaceId/restore`.
- The default workspace remains non-archivable.

### API scope enforcement
- Workspace-prefixed routes now validate that the workspace exists and is active before normal scoped operations.
- Body-scoped operations using `validateScope` now validate workspace existence/activity as well as the supplied task ID.
- The restore endpoint is intentionally exempt from the active-only middleware so an archived workspace can be restored.

### Tests added
- `server/store.test.ts`: legacy conversation and attachment migration, preservation of existing scope, ambiguous/orphan handling, persistence, idempotence.
- `server/workspaces-api.integration.test.ts`: administrator-token requirement, create/archive/restore, archived-workspace denial, archived listing, and invalid body-scoped workspace rejection.
- Expanded `server/editorial-workspaces.test.ts` to cover archive restoration.

## Validation status

- Earlier PR head `306601b2` had a successful GitHub Actions validation run.
- The tests and code above were added after that earlier run.
- A fresh GitHub Actions run for the latest PR head was not returned by the available workflow-run query at the time of this log.
- Vercel status for the latest commit was `pending`; no successful preview build is claimed.
- Therefore, the new changes are **implemented but not yet CI-verified**.
- No merge, production deployment, paid provider call, or external publishing operation was performed.

## Remaining work before frontend workspace rollout

1. Obtain a fresh CI result for the latest PR head; fix any failures.
2. Review the new integration test's process lifecycle and ensure the CI runner has Node.js 22 and required native optional dependencies.
3. Add tests for cross-workspace conversation and attachment denial at the HTTP boundary.
4. Add workspace selection and lifecycle UI; remove hard-coded `main-workspace` references from frontend data flows.
5. Ensure switching workspaces clears stale conversation, article, attachment, library, and browser-session selection state.
