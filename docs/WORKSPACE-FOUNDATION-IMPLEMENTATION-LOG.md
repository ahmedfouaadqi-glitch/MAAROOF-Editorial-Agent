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

## Frontend workspace management update

- Added a single-admin workspace manager to the sidebar.
- The manager loads active and archived workspaces through the authenticated API.
- Added workspace switching, create, rename, archive, and restore actions.
- Switching workspace changes the workspace scope for conversations, articles, clients, brands, evidence, drafts, review, AI visibility, magazine submissions, browser publishing, and the saved-draft library.
- Workspace changes clear article and review selections to avoid carrying stale task selections into another workspace.
- The library reloads when the selected workspace changes.
- Replaced hard-coded main-workspace frontend API/panel bindings with the selected workspace ID. Remaining main-workspace references are intentional defaults/fallbacks and default-workspace protection.
- Added an integration test proving article listing and stage updates do not cross workspace boundaries.

## Current validation status after frontend update

- Latest commit: 3637b963868af4b2b2195a1580e1578e6b4c7822.
- GitHub Actions workflow-run query returned no runs for this commit; this is not evidence of a passing test suite.
- Vercel status is FAILURE with a target URL indicating a build-rate-limit/plan restriction (upgradeToPro=build-rate-limit). This is an infrastructure/account limit signal, not a code-level build result; no successful preview build is claimed.
- No local test execution is available through the current connected repository tools.
- PR remains open and draft. No merge or production deployment was performed.

### Workspace-switch cleanup follow-up
- Chat state is reset when the active workspace changes; the conversation list reloads against the new workspace route.
- Pending conversation handoffs and browser publishing drawer/draft state are cleared on workspace change.
- Latest recorded code commit: fbae9fecc9b82d7779d3c71a4ccfe35531d6061c.
- Latest Vercel check remains failed due to the build-rate-limit/plan restriction; GitHub Actions workflow lookup still returns no run. Code validation remains outstanding.

## Stage 1 verification and Stage 2 shell update

### Additional workspace-boundary coverage
- Added API integration coverage for cross-workspace conversation reads, attachment listing, cancellation, browser destination listing, browser session listing, and AI Visibility reads/writes.
- AI Visibility now validates that the requested workspace exists and is active for both read and write operations.
- Added browser runtime tests for mixed public/private DNS answers, loopback/private IPv4 and IPv6 literals, IPv4-mapped IPv6 loopback, and hostname suffix boundaries.
- Corrected the legacy migration test expectation: an unscoped attachment inherits the workspace of its uniquely linked conversation whether that conversation was itself migrated or already scoped.

### Stage 1 CI gate
- Commit f41cf973279eea8934be6cf90573257499ea4a3b passed GitHub Actions run 41962963041: TypeScript typecheck, all 208 tests across 40 test files, and production build.
- This is repository CI evidence; it is not a live browser end-to-end test or a production deployment.

### Stage 2 — Agent-first navigation
- Replaced the old primary navigation with three persistent destinations: Conversation, History, and Workspaces.
- Added a dedicated conversation history view scoped to the active workspace; selecting a record reopens the original conversation.
- Moved workspace lifecycle controls into a dedicated Workspaces view and retained the active workspace indicator in the shell.
- Hid legacy dashboard/registry/library/settings destinations from primary navigation without deleting their underlying code or data.
- Kept browser handoff available from the conversation surface rather than presenting it as a separate primary destination.
- Fixed a TypeScript navigation badge comparison identified by CI.
- Commit bc0059e79642f19f232bfa2f78570f97f130785e passed GitHub Actions run 41963192896: typecheck, 208 tests across 40 files, and production build.

### Current external deployment status
- Vercel still reports a build-rate-limit/plan restriction. No successful preview deployment is claimed.
- PR #10 remains draft and unmerged. No production deployment or external publishing action was performed.

### Remaining before this foundation can be approved
1. Run a browser end-to-end test against a controlled owned publishing site and verify workspace switching/history behavior in the browser.
2. Resolve Vercel preview build availability or provide another controlled preview environment.
3. Complete the broader browser-worker adversarial review, especially DNS rebinding/TOCTOU behavior and redirect/subresource edge cases.
4. Continue Stage 3: formalize and test the conversation orchestrator's plan/act/observe/reflect lifecycle, retry/cancel behavior, step provenance, and cost gates.