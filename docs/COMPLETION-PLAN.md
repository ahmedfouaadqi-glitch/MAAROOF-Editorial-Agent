# MAAROOF Editorial Agent — Completion Plan

This plan follows the requested browser-first editorial platform scope. A checked item means code exists; it does not imply a live provider, authorized account or external publication has been verified.

## Operating constraints
- Keep React + Vite + TypeScript and the Lovable/GitHub-compatible frontend.
- Supabase is excluded.
- Firecrawl is optional, server-side and controlled by per-article quotas.
- Article-writing LLM use is deferred; no model calls are part of the current phase.
- Keep API keys and browser session material out of frontend code.
- Never bypass CAPTCHA, MFA, account restrictions, robots directives, editorial policy or destination safeguards.
- Never equate search results with verified sources, a submission with acceptance, or a button click with publication.
- Do not merge to main or publish to a live destination without explicit authorization.

## Ordered completion phases

### 0. Branch and quality gates
- Confirm branch, PR head, current CI and repository configuration.
- Run typecheck, unit tests and production build after each functional milestone.
- Keep all implementation on the feature branch; do not merge without approval.
- Acceptance: green CI on the current PR head and no unsupported completion claims.

### 1. Research acquisition, Firecrawl and provenance
- [x] Provider-neutral bounded search contract and optional Brave adapter.
- [x] Firecrawl v2 server adapter for search and Markdown scraping.
- [x] Per-article server-enforced quotas: 3 scrapes, 5 searches and 5 structure inspections by default; limits configurable through admin settings.
- [x] Store retrieval time, provider, source URL and unverified status.
- [x] Local structure inspection for word count, headings, links and structural warnings.
- [ ] Verify live Firecrawl behavior using an operator-owned API key and an explicitly approved controlled test.
- [ ] Strengthen destination allowlists and DNS/IP controls; current URL validation is not a complete DNS-rebinding defence.
- [ ] Add canonical URL resolution, freshness evaluation, corroboration and immutable evidence lineage.
- Acceptance: every search/scrape retains provider, timestamp, URL, acquisition method and verification state; no paid request is made by CI.

### 2. GEO and editorial intelligence
- [x] Manual sources, claims, source assessment, evidence excerpts and conflict summaries.
- [x] Article-scoped entities, aliases, deterministic alias matching and explicit relationships.
- [x] Arabic/English outline and editorial objective scaffolding.
- [ ] Extend the PostSuggester design patterns into article briefs: language, goal, market, audience, publication fit, output structure and distinct editorial angle.
- [ ] Implement evaluated entity extraction/resolution, related questions, search intent and semantic topic clusters.
- [ ] Add evidence-backed GEO readiness diagnostics: entity coverage, evidence coverage, answerability, freshness, structure and editorial distinctiveness.
- [ ] Keep GEO readiness separate from measured AI search visibility; keyword density alone is not GEO proof.
- Acceptance: every factual assertion is linked to evidence or flagged; scoring exposes rubric and missing data.

### 3. Human editing, originality and approval
- [x] Human-editable article drafts and objective-based outline scaffold.
- [x] Draft-bound source, originality, media and editorial approval gates.
- [x] Deterministic exact-match and lexical overlap baseline.
- [ ] Add semantic similarity and cross-language duplication checks with a validated multilingual corpus.
- [ ] Compare repeated article angles, entities, claims and narrative structure across workspace, client and brand.
- [ ] Add article version history and durable review records.
- [ ] Complete SEO metadata and publication-specific article packaging.
- Acceptance: same-brand topic overlap is not automatically a duplicate; repeated substance/angle is surfaced for review.

### 4. Media intelligence
- [ ] Add authenticated upload with size, MIME and content validation, safe filenames and workspace isolation.
- [ ] Analyze uploaded image content and rank contextual placement against article sections.
- [ ] Support licensed/authorized image discovery, rights/creator/license/attribution records and human confirmation.
- [ ] Generate captions, alt text, image dimensions and contextual insertion positions.
- [ ] Upload and insert selected images through destination browser workflows.
- Acceptance: each inserted visual has known source and rights state; no unknown-rights asset is silently published.

### 5. Magazine and destination registry
- [x] Preserve the user's 17 platform seed records.
- [x] Separate editorial/self-publishing destinations from developer sites, Q&A communities, encyclopedias, research repositories and data archives.
- [x] Add candidate editorial publications and submission policy metadata.
- [ ] Verify current editorial guidelines, eligibility, rights, exclusivity, disclosure, word limits, image rules and submission path for each selected destination.
- [ ] Add destination-specific browser adapters and capability tests.
- [ ] Add manual handoff where automated submission is not allowed or not reliable.
- Acceptance: every destination is tested independently; candidate status is never represented as guaranteed acceptance or an enabled publisher.

### 6. Browser Publishing Agent — core outstanding capability
- [ ] Add independent Node.js Playwright + Chromium worker; never execute browser automation in the Vite frontend.
- [ ] Build durable job steps and browser session lifecycle per workspace/account/destination.
- [ ] Open destination website and detect login state.
- [ ] Pause and display a secure user handoff for login, MFA and CAPTCHA; resume the same task after user completion.
- [ ] Fill title/body, upload and position images, set categories/tags/byline/disclosure and preview.
- [ ] Support user-approved publishing, draft-only and manual handoff modes according to destination policy.
- [ ] Persist screenshots, step logs, external submission/publication IDs and final URL.
- [ ] Handle expired sessions, network interruptions, timeouts and safe retries without duplicate posts.
- [ ] Verify external result independently before marking submitted/published.
- Acceptance: one selected, operator-authorized destination completes an end-to-end browser test. A submission is not considered accepted or published without external evidence.

### 7. Publishing orchestration
- [x] Local magazine submission records, status model and human approval/exclusivity gates.
- [ ] Durable job queue, locking, heartbeat, timeout, idempotency and retry policy.
- [ ] Schedule posts/articles and prevent duplicate submissions across retries and destinations.
- [ ] Record destination response, editor messages and revision requests.
- [ ] Reconcile local status against external destination state.
- Acceptance: retrying after an interruption never creates an unintended duplicate.

### 8. Workspace, identity and non-Supabase production foundation
- [ ] Build real user authentication, workspace membership, roles and server-side authorization.
- [ ] Complete workspace → client → brand → article → destination/account → publishing-job isolation.
- [ ] Replace the shared admin bearer token for production use.
- [ ] Replace single-process JSON with a self-managed transactional database and migrations; no Supabase dependency.
- [ ] Add durable queue and object storage for uploaded images, drafts, screenshots and browser artifacts.
- [ ] Encrypt external credentials and browser storage state; add secrets management, backups, restore, audit logs and rotation.
- Acceptance: cross-workspace access, concurrent job, backup/restore and authorization tests pass.

### 9. MAAROOF AI future API
- [ ] Define scoped, authenticated, versioned REST endpoints for article requests, context exchange, validation, originality and publication state.
- [ ] Accept explicit workspace/client/brand identifiers and only authorized context.
- [ ] Return article versions, evidence references, quota usage, job state and verified publication URLs.
- [ ] Add idempotency, rate limits, audit logs and optional webhooks.
- Acceptance: no direct access to MAAROOF AI database; cross-workspace requests are denied.

### 10. Deferred: AI article writing
- [ ] Revisit model provider selection only after human-authored workflow, cost controls, evidence contracts and article evaluations are complete.
- [ ] Add evidence-constrained generation with no unsupported facts, quotes, figures or citations.
- [ ] Add output-quality, bilingual and hallucination evaluation before enabling.
- Acceptance: explicit product approval, provider credentials and a documented cost ceiling before any paid model call.

### 11. Production acceptance
- [ ] Test end-to-end: workspace → client/brand context → research → GEO brief → human article editing → source and duplication checks → media → approval → browser login handoff → destination input → publish/submit → external verification.
- [ ] Test Arabic and English, failed provider calls, exhausted quotas, invalid credentials, CAPTCHA/MFA handoff, browser crashes, session expiry, retries and duplicate prevention.
- [ ] Run security, performance, responsive, accessibility, dependency and secret scans.
- Acceptance: green CI plus documented external verification for every enabled destination. Anything untested remains disabled.

## External prerequisites
1. Server-side Firecrawl key and approval for controlled live research requests.
2. Authorized user accounts for any destination selected for browser publishing.
3. Publication-specific policy/eligibility confirmation and any required editorial approval.
4. Production host, self-managed database, encrypted secret store and durable job worker.
5. Future MAAROOF AI API credentials/contract and workspace authorization rules.
6. A later explicit decision and budget for model-assisted article writing.

No prerequisite is assumed to exist until it is supplied and verified.
