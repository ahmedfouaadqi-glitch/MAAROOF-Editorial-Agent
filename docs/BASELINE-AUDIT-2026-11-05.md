# Repository Baseline Audit — 2026-11-05

## Audit scope and method

Read-only inspection of the GitHub repository `ahmedfouaadqi-glitch/MAAROOF-Editorial-Agent`, branch `feat/agent-first-editorial-workspace`, including the current workspace PR, CI workflow, package manifest, API/server modules, conversation and attachment ownership code, browser runtime, README, and available skill-audit artifacts in the ChatGPT Library.

No production deployment, paid provider call, external publication, or merge was performed.

## Repository and branch baseline

- Runtime: Node.js ESM; Node.js >=22.
- Frontend: React + Vite + TypeScript.
- Persistence: local JSON file store; local media directory.
- Browser: Playwright Chromium worker, isolated browser contexts.
- Model integration: server-side OpenAI-compatible provider.
- Supabase: not used by this repository.
- Next.js: not used by this repository.
- Vercel project and production deployment are tracked separately; this audit does not certify live browser behavior.

Branches observed:
- `main`
- `feat/agent-first-editorial-workspace`
- `feat/browser-agent-execution`
- `feat/editorial-intelligence`
- `feat/lovable-foundation-magazine-registry`
- `feat/manus-inspired-task-starters`
- `feat/manus-task-first-ux-verified`
- `feat/media-intelligence`
- `feat/originality-engine`
- `feat/platform-native-social-publishing`
- `fix/rolldown-optional-native-bindings`
- `integration/editorial-intelligence-media`

## PR #10 and CI

PR #10: `feat: introduce workspace lifecycle for agent-first editorial workflow`

Head commit: `306601b2b56c997bcf5d3ce8c27b40e96f5fffd7`

Changed files:
- `docs/AGENT-FIRST-IMPLEMENTATION.md`
- `server/editorial-workspaces.mjs`
- `server/editorial-workspaces.test.ts`
- `server/main.mjs`
- `server/store.mjs`

GitHub Actions run `41960277806` completed successfully. The `validate` job passed:
- dependency installation
- TypeScript typecheck
- unit tests
- production build

This is CI evidence for the PR head, not proof of browser end-to-end behavior or production readiness. No PR review submissions or inline review threads were returned at audit time.

## Confirmed implementation

- Workspace domain functions exist: create, list, get, update and archive.
- Stable default workspace ID: `main-workspace`.
- JSON store seeds the default workspace on fresh and legacy store initialization.
- Authenticated workspace collection/item API routes exist.
- Conversation and attachment records created through the newer conversation flow carry `workspaceId`; ownership helpers compare both workspace and conversation IDs.
- Existing isolated Playwright worker creates a separate browser context and applies HTTPS/approved-host/DNS validation to routed requests.
- Existing README explicitly documents prototype limitations and incomplete research/browser handoff behavior.

## Gaps and risks found

### P0 — Legacy data migration is incomplete

`JsonStore.init()` creates the default workspace, but does not backfill `workspaceId` onto legacy conversation or attachment records that predate the workspace-scoped conversation model. The newer list/ownership functions filter by exact `workspaceId`. If older records lack this field, they will not appear in the default workspace and ownership checks will reject access. Before any workspace rollout, implement a deterministic, idempotent migration that assigns only confirmed legacy unscoped records to `main-workspace`, preserves already scoped records, and tests attachment/conversation linkage.

### P0 — Workspace isolation is not yet user/tenant authorization

The API currently protects routes with one shared `ADMIN_API_TOKEN`. Workspace IDs are request path parameters; the server does not derive allowed workspace membership from an authenticated user identity. This is an admin-gated prototype boundary, not multi-user tenant isolation. Do not describe it as production-grade multi-tenant security.

### P1 — Frontend still assumes one workspace

`src/App.tsx` hard-codes `main-workspace` in the chat, library, and browser panel flows. The sidebar shows a static workspace label and still renders the old multi-section navigation. There is no end-user workspace list/create/rename/switch/archive flow yet. PR #10 is backend foundation only.

### P1 — Archived workspaces cannot be restored

`getWorkspace()` rejects archived workspaces; `updateWorkspace()` calls `getWorkspace()`. Consequently, the existing update path cannot reactivate an archived workspace. Add a deliberate restore path or explicitly make archive irreversible with clear product behavior. Preferred behavior: support restore with tests and archived-list visibility.

### P1 — Workspace existence is not consistently checked on all scoped routes

Workspace CRUD validates workspace records, but many workspace-scoped API handlers pass a path ID into domain functions that only filter records by ID. Before multi-workspace UI, centralize active-workspace validation and ensure archived/nonexistent workspaces cannot create new conversations, attachments, browser sessions, or content.

### P1 — Browser security needs dedicated adversarial tests

The worker validates HTTPS, DNS resolution, approved hosts, and request routing. The audit did not establish complete coverage for DNS rebinding, IPv4/IPv6 private and link-local ranges, redirects, alternate IP encodings, IDN normalization, subresource policy, or browser navigation edge cases. Keep the worker isolated and add adversarial tests before expanding browser actions. No CAPTCHA/MFA/access-control bypass should be added.

### P1 — Skill inventory is not yet integrated into this repository

The Library contains a skill audit and archive manifest describing **80 ZIP archives**, 10 exact duplicate copies, 70 distinct package variants, and 69 unique skill names. This differs from the earlier planning shorthand of 84 archives; use the audited 80/70/69 corpus unless a newer reconciled manifest proves otherwise. The skill corpus is not yet proven to exist as a runtime package in this Editorial Agent repository. Treat it as source knowledge to reconcile and port selectively, not as 69 executable tools.

### P2 — Documentation and implementation are at different maturity levels

The agent-first contract describes target behavior. The README still records meaningful incomplete areas: live research in the chat path, automatic page/field discovery, media insertion into site editors, durable multi-user storage, persistent job queue, and production security controls. Keep target architecture separate from verified current capability.

## Existing capability boundaries to preserve

- Originality Engine: exact/lexical comparison within saved workspace content; not semantic paraphrase detection or public-web plagiarism verification.
- Editorial Intelligence: deterministic structural/phrase/coverage indicators; not fact checking, ranking prediction, CPC/volume measurement, or actual GEO visibility.
- Media Intelligence: metadata-only image inspection; not semantic image recognition, factual alt-text validation, rights verification, or full video analysis.
- Research: configured provider paths are not proof that the chat orchestrator executes live search/scrape; paid calls remain gated.
- Browser handoff: user-controlled session; no automatic publication click is enabled.

## Required gates before Stage 1 UI rollout

1. Implement and test idempotent legacy workspace migration.
2. Add API-level tests for workspace auth, active-workspace checks, archive/restore, and cross-workspace read/write denial.
3. Define whether this release remains single-admin or introduces authenticated user-to-workspace membership. Do not imply multi-tenant isolation before the latter exists.
4. Implement workspace switching and CRUD in the UI, then remove fixed `main-workspace` assumptions through a single active-workspace context.
5. Add browser security tests for private IPs, redirects, DNS resolution, host suffix matching, IDNs, and disallowed navigation.
6. Reconcile the 69 skill names against the current Editorial Agent's actual capabilities and tests; no mass import and no 69 new tools.
7. Run typecheck, unit, API integration, browser tests on a controlled owned site, and production build.

## Decision

Stage -1 and Stage 0 audit findings are recorded. PR #10 has passing CI but is not approved for merge or production release by this audit. Stage 1 should not proceed until the P0 migration and authorization decisions are resolved and the implementation contract is updated accordingly.
