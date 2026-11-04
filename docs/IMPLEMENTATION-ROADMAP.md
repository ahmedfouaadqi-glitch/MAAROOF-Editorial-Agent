# Implementation Roadmap (Supabase deferred)

## Track A — Platform and editorial contracts
- [x] React + Vite + TypeScript foundation.
- [x] Import the 17 user-provided platform records.
- [x] Separate editorial destinations from communities, repositories, and data sources.
- [x] Add platform capability profiles and verification checklists.
- [x] Add a fail-closed publication gate.
- [x] Define editorial task, evidence, claim, draft, and engine interfaces.
- [ ] Verify current API/publishing policies for each selected target.
- [ ] Implement and test the first publishing adapter against a site owned by the user.

## Track B — Editorial intelligence (provider-neutral)
- [ ] Implement research source ingestion with provenance and retrieval timestamps.
- [ ] Implement claim-to-evidence mapping.
- [x] Add configurable research budget model with separate per-article crawl/search/inspect limits.
- [x] Add an initial admin screen for editing the limits (session-local prototype only).
- [ ] Connect budget settings to backend configuration and enforce reservations before every Firecrawl/provider call.
- [ ] Add durable, atomic per-task usage accounting across concurrent workers.
- [ ] Implement entity and search-intent extraction.
- [ ] Implement outline and bilingual article draft contracts.
- [ ] Implement originality checks with exact and near-duplicate baselines.
- [ ] Add deterministic unit tests without paid model calls.
- [ ] Add model-provider interface only after engine contracts are tested.

## Track C — Independent execution services
- [ ] Node.js API service with authentication middleware contract (no database dependency in first local prototype).
- [ ] Durable job state abstraction and idempotency.
- [ ] Isolated Playwright + Chromium worker.
- [ ] Login handoff and session expiry recovery.
- [ ] Publication reconciliation and external verification.

## Track D — Deferred integrations
- [ ] Supabase persistence/auth/RLS — deferred until explicitly requested.
- [ ] MAAROOF AI scoped API integration.
- [ ] Deployment, secrets management, monitoring, and cost ledger.

## Acceptance rules
- A contract or UI status is not proof of a working engine.
- A test fixture is not proof of live external behavior.
- No platform is publish-enabled until the fail-closed gate can pass on a real authorized account.
- No real publication test without explicit approval.
