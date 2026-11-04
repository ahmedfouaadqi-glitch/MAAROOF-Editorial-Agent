# Implementation Roadmap (No Supabase / No Firecrawl)

## Track A — Platform and editorial contracts
- [x] React + Vite + TypeScript foundation.
- [x] Import the 17 user-provided platform records.
- [x] Separate editorial destinations from communities, repositories, and data sources.
- [x] Add platform capability profiles and verification checklists.
- [x] Add a fail-closed publishing gate.
- [x] Define editorial task, evidence, claim, draft, and engine interfaces.
- [ ] Verify current API/publishing policies for each selected target.
- [ ] Implement and test the first publishing adapter against a site owned by the user.

## Track B — Editorial intelligence without automated crawling
- [x] Implement manual source URL registration with workspace/task association and timestamps; do not fetch remote contents.
- [x] Add configurable per-article source URL, search, and inspection quotas (3 / 5 / 5 defaults).
- [x] Add an admin screen connected to the standalone Node API.
- [x] Persist limits and task usage in a local JSON store.
- [x] Enforce source URL registration limits atomically with source insertion.
- [x] Add idempotent reservation, commit, and release operations for search/inspection quotas.
- [ ] Connect a selected external search provider if live research is later required; no Firecrawl or crawler integration is planned.
- [x] Implement claim-to-source linking with workspace/task isolation and source-link coverage reporting.\n- [ ] Implement evidence quality review (source credibility, recency, and whether the source actually supports each claim).
- [ ] Implement entity and search-intent extraction.
- [ ] Implement outline and bilingual article draft assembly.
- [x] Add deterministic exact-match and token-overlap near-duplicate checks against previously submitted workspace text.\n- [ ] Add semantic, cross-language, and external-corpus originality checks; these require validated embeddings/models and a wider corpus.
- [x] Add deterministic tests for evidence linking, workspace isolation, Arabic normalization, and exact-match detection.\n- [ ] Add deterministic tests for the remaining editorial engines.
- [ ] Add model-provider interface only after engine contracts are tested.

## Track C — Independent execution services
- [x] Standalone Node.js API with admin bearer-token protection.
- [x] Serialized atomic JSON persistence within one API process.
- [x] Workspace-scoped research usage and source-reference records.
- [ ] Add real user authentication and authorization before production multi-tenant deployment.
- [ ] Add durable editorial task/job lifecycle and recovery.
- [ ] Add isolated Playwright + Chromium worker only for platforms where browser automation is permitted.
- [ ] Add login handoff, session expiry recovery, and publication reconciliation.

## Track D — Explicitly excluded / deferred
- [x] Supabase excluded from this implementation.
- [x] Firecrawl and automated crawling excluded.
- [ ] MAAROOF AI scoped API integration.
- [ ] Production deployment, secrets management, monitoring, and cost ledger.
- [ ] Multi-instance persistence and atomic cross-process quotas.


## Track E — Frontend product experience
- [x] Replace the prototype shell with a responsive Linear-inspired workspace.
- [x] Build a vector-first editorial dashboard with original inline SVG artwork.
- [x] Integrate React Bits SpotlightCard with upstream source attribution and license.
- [x] Add light mode default, dark mode, Arabic-first RTL, and English shell labels.
- [x] Add desktop sidebar and mobile bottom navigation.
- [x] Connect article creation and article listing to the standalone Node API.
- [x] Add controlled one-stage-at-a-time article progression in the UI.
- [x] Retain platform registry, capability inspector, and backend research settings.
- [ ] Add authenticated user/workspace switching and role-based navigation.\n- [x] Add article-level evidence workspace UI for manual sources, claim linking, and local originality checks.
- [ ] Add functional notifications, file/media upload, editorial evidence workspace, and approval inbox.
- [ ] Add browser-level responsive and accessibility tests.

## Acceptance rules
- A contract or UI status is not proof of a working engine.
- A registered URL is not proof that its content was fetched or verified.
- A quota reservation is not proof that a search provider ran.
- A test fixture is not proof of live external behavior.
- No platform is publish-enabled until its policy, account, and end-to-end behavior have been verified.
- No real publication test without explicit approval.