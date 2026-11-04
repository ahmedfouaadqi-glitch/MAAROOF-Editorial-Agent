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
- [ ] Implement claim-to-evidence mapping and evidence quality review.
- [ ] Implement entity and search-intent extraction.
- [ ] Implement outline and bilingual article draft assembly.
- [ ] Implement exact and near-duplicate originality checks.
- [ ] Add deterministic tests for the remaining editorial engines.
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

## Acceptance rules
- A contract or UI status is not proof of a working engine.
- A registered URL is not proof that its content was fetched or verified.
- A quota reservation is not proof that a search provider ran.
- A test fixture is not proof of live external behavior.
- No platform is publish-enabled until its policy, account, and end-to-end behavior have been verified.
- No real publication test without explicit approval.