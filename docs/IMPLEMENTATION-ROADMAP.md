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
- [x] Add a provider-neutral, fail-closed live-search contract with bounded request validation, result normalization, URL filtering, deduplication, and explicit unverified provenance.
- [x] Add an optional server-side Brave Web Search adapter, quota-metered workspace/task API, persisted search history, and UI for searching/registering results as unverified manual sources. Disabled by default; no key or live call used in tests.
- [ ] Select and connect an external search provider after provider, pricing, data handling, and credentials are approved; no Firecrawl or crawler integration is planned.
- [x] Implement claim-to-source linking with workspace/task isolation and source-link coverage reporting.
- [x] Add manual source metadata review, temporal fields, methodology, jurisdiction, and quality rationale.
- [x] Add manual excerpt-to-claim evidence records with support/contradiction/context/unclear stances.
- [x] Surface conflicting evidence per claim without automatic truth adjudication.
- [ ] Add independently verified source acquisition, freshness monitoring, and corroboration after a provider is selected.
- [x] Add a typed, article-scoped entity registry with canonical names, aliases, and disambiguation notes.
- [x] Add deterministic matching of registered aliases against editorial claims.
- [x] Add explicit entity relationships linked to supporting claim IDs, with unverified evidence states.
- [ ] Implement model-assisted named-entity recognition, entity resolution, and search-intent extraction after provider contracts and evaluation sets are ready.
- [x] Add a workspace-scoped, deterministic objective-based outline scaffold and human-editable draft persistence/UI in Arabic and English. This is a deterministic scaffold. Optional model-assisted drafting is implemented behind server configuration and explicit invocation; it remains disabled until a provider is selected and credentials are installed.
- [x] Add deterministic exact-match and token-overlap near-duplicate checks against previously submitted workspace text.
- [ ] Add semantic, cross-language, and external-corpus originality checks; these require validated embeddings/models and a wider corpus.
- [x] Add deterministic tests for evidence linking, workspace isolation, Arabic normalization, and exact-match detection.
- [ ] Add deterministic tests for the remaining editorial engines.
- [x] Add an opt-in server-side OpenAI-compatible model adapter and evidence-constrained article drafting engine, with explicit user invocation, atomic per-article request limits, and usage records; no provider is enabled by default.
- [ ] Add model-assisted named-entity recognition, entity resolution, and search intent extraction after evaluation sets are ready.

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
- [ ] Add authenticated user/workspace switching and role-based navigation.
- [x] Add article-level evidence workspace UI for manual sources, claim linking, and local originality checks.
- [ ] Add functional notifications, file/media upload, and approval inbox.
- [x] Add article-level editorial evidence and entity intelligence workspaces.
- [ ] Add browser-level responsive and accessibility tests.

## Acceptance rules
- A contract or UI status is not proof of a working engine.
- A registered URL is not proof that its content was fetched or verified.
- A quota reservation is not proof that a search provider ran.
- A test fixture is not proof of live external behavior.
- No platform is publish-enabled until its policy, account, and end-to-end behavior have been verified.
- No real publication test without explicit approval.

## Track F — AI discovery, indexing, citation, and training evidence

- [x] Define separate evidence states for crawler fetch, search indexing, AI citation, and training attestation.
- [x] Add a workspace-scoped AI visibility event ledger in the Node API.
- [x] Add admin endpoints to list and record observations.
- [x] Add an admin dashboard for event history and separate verified counters.
- [x] Require evidence URL and verification note for verified indexing, citation, and training claims.
- [x] Document provider crawler distinctions and the limitations of article-level training attribution.
- [ ] Ingest web server/CDN logs for domains controlled by the workspace.
- [ ] Validate crawler identity using provider-published IP ranges; never trust user-agent alone.
- [ ] Connect Google Search Console URL Inspection with explicit OAuth authorization.
- [ ] Evaluate Bing Webmaster API integration and permissions.
- [ ] Build controlled AI answer/citation sampling with stored query, model/product, locale, timestamp, source URL, and evidence capture.
- [ ] Add canonical URL, robots/noindex, sitemap, structured-data, and response-status audits.
- [ ] Add per-domain connection ownership, access scopes, audit trail, and retention settings.
- [ ] Add alerting for crawl failures, indexing loss, citation changes, and canonical/robots regressions.

## Track G — Complete publishing and magazine execution

- [x] Keep magazine/CMS destinations separate from social networks, communities, research repositories, and data sources.
- [x] Add a candidate magazine publication registry with editorial submission requirements.
- [x] Add platform-native social publishing profiles.
- [ ] Restore and reconcile the exact original user-provided magazine list when its source file/list is available; do not invent missing titles.
- [ ] Verify current submission rules, exclusivity, rights, accepted formats, and official submission routes for every candidate magazine.
- [ ] Implement publication profiles in the admin UI (domain, language, region, audience, topic fit, route, rules, account status).
- [x] Add a pitch-first magazine submission inbox UI connected to the workspace-scoped API, with article/publication selection, draft creation, approval, exclusivity gating, editor-response states, and manual lifecycle controls. Actual sending and external publication verification remain pending.
- [x] Add workspace-scoped backend records for magazine pitches, approval, submission, editor response, acceptance, rejection, withdrawal, and manual publication status; enforce approval and exclusivity gates. Frontend inbox, actual sending, and external publication verification remain pending.
- [ ] Build the first authorized CMS publishing adapter for a user-owned WordPress/Ghost site.
- [ ] Add Playwright + Chromium isolated runtime only for permitted destinations where no suitable API exists.
- [ ] Implement media library, image rights/credits, crops, hero images, alt text, video covers, and subtitles.
- [ ] Implement platform-specific editorial variant generation and validation for social networks.
- [ ] Add end-to-end tests for draft, preview, approval, submission, publish, and external verification.
- [ ] Add production authentication, multi-tenant authorization, durable jobs, secrets management, monitoring, and non-JSON shared persistence.

## Measurement truth rules

- Crawler fetch is not indexing.
- Indexing is not citation.
- Citation is not training.
- A training-purpose crawler request is not proof of article-level training use.
- A submission is not acceptance; acceptance is not publication.
- A publication is not proof of indexing or AI citation.
- No destination is marked publish-ready until its policy, account access, adapter, and verification path pass end-to-end tests.
