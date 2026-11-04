# MAAROOF Editorial Agent — Completion Plan

This plan is the acceptance baseline for completing the product end to end. A checked code item means that its implementation exists and has passed the repository's automated checks; it does not imply that a live provider, account, or destination has been connected.

## Operating constraints

- Keep the React + Vite + TypeScript frontend and standalone Node.js API.
- Keep Supabase and Firecrawl out of this implementation.
- Do not make paid model/search requests during CI or automated tests.
- Keep API keys server-side and never place secrets in Vite variables or source control.
- Never bypass CAPTCHA, MFA, paywalls, account restrictions, robots directives, or destination policy.
- Never equate a search result with a verified source, a submitted pitch with acceptance, or an accepted manuscript with publication.
- Do not merge to `main` or publish to a live destination without explicit authorization.

## Ordered completion phases

### 0. Baseline, branch integrity, and quality gates
- Confirm branch, PR head, default-branch diff, current CI, and repository configuration.
- Run typecheck, unit tests, and production build after each functional milestone.
- Verify that all new files are on the feature branch and that no unintended source changes remain on the default branch.
- Acceptance: clean branch ownership, green CI on current PR head, and no undocumented behavior claims.

### 1. Research acquisition and source provenance
- [x] Provider-neutral search contract with bounded inputs, result normalization, URL filtering, deduplication, and unverified provenance.
- [x] Optional server-side Brave Web Search adapter; quota-metered API, stored history, and article UI for adding results as manual source references.
- [ ] Enable a provider using operator-owned credentials and verify one controlled live request.
- [ ] Add safe, policy-compliant page-content acquisition or a provider content-context adapter; protect against SSRF, private-network access, redirects, oversized responses, and unsupported content.
- [ ] Add source freshness evaluation, corroboration records, canonical URL handling, and evidence lineage.
- Acceptance: every fetched/search result retains provider, timestamp, URL, acquisition method, and verification state; failures are visible and metered.

### 2. Evidence, claims, entities, and research intelligence
- [x] Article-scoped source, claim, entity, alias, and relationship registries.
- [x] Manual excerpt-to-claim records with support/contradiction/context/unclear stances.
- [x] Deterministic alias matching and conflict summaries.
- [ ] Add model-assisted NER, entity resolution, multilingual search intent, and relation suggestions behind a provider interface and evaluation set.
- [ ] Add human adjudication and immutable evidence review history.
- Acceptance: model suggestions never become verified facts or relations without explicit review; workspace and article isolation are tested.

### 3. Article drafting, validation, and editorial approval
- [x] Arabic/English deterministic outlines and human-editable draft persistence.
- [x] Structural draft validation baseline and local exact/near-match originality checks.
- [x] Add an opt-in OpenAI-compatible model adapter and evidence-constrained article drafting service with server-side secrets, explicit invocation, bounded output tokens, atomic per-article request limits, and usage records. No provider is selected or enabled by default.
- [ ] Add model-assisted NER, entity resolution, multilingual search intent, and relation suggestions behind a provider interface and evaluation set.
- [ ] Add draft-version snapshots, editorial review decisions, approval freshness, and fail-closed readiness checks.
- [ ] Add SEO metadata, structured article variants, fact-check coverage, and publication export formats.
- Acceptance: a draft cannot become ready-to-publish without a current approved review of the exact draft version and completed required checks.

### 4. Media and rights management
- [ ] Add authenticated upload limits, MIME/content validation, safe file names, malware scanning integration point, and workspace isolation.
- [ ] Record source, license, creator, attribution, consent/rights notes, crop variants, dimensions, and alt text.
- [ ] Generate image variants and social thumbnails without overwriting source assets.
- Acceptance: no asset can be attached to a public post without rights metadata and a human approval state.

### 5. CMS publishing
- [ ] Implement WordPress REST and Ghost Admin API draft adapters using server-side secrets only.
- [ ] Support create/update draft, idempotency keys, remote-ID persistence, retries, and reconciliation.
- [ ] Add preview and explicit human publish approval; default remote status is draft.
- Acceptance: integration tests use mocked APIs; live tests are performed only on an operator-owned test site with explicit authorization.

### 6. Magazine submission workflow
- [x] Magazine candidate registry and local pitch/submission lifecycle.
- [x] Approval and exclusivity gates in the local workflow.
- [ ] Restore the exact original publication list from the operator's source data.
- [ ] Verify official policies, rights, exclusivity, format, and submission routes for selected publications.
- [ ] Add export/send handoff and response tracking; no automated pitch send without explicit approval and credentials.
- Acceptance: submission status is backed by an actual action record or clearly marked as a manual operator update.

### 7. Social publishing
- [x] Platform catalog and capability profiles.
- [ ] Build platform-specific content variants, constraints, previews, alt text, and media rules.
- [ ] Implement OAuth/account connections and API adapters for selected networks.
- [ ] Add scheduling, rate-limit handling, retries, idempotency, post IDs, and post URL reconciliation.
- Acceptance: live publishing remains disabled until each account, scope, policy, adapter, and verification flow passes an authorized test.

### 8. Browser execution worker
- [ ] Add a separate Playwright/Chromium worker with isolated browser contexts, storage-state encryption, timeouts, and job heartbeats.
- [ ] Add user handoff for login, CAPTCHA, and MFA; never automate bypass.
- [ ] Add safe-domain allowlists, navigation/download restrictions, session expiry handling, and publication reconciliation.
- Acceptance: browser automation is restricted to permitted sites and never runs in the frontend or within the API request process.

### 9. AI visibility and search discovery monitoring
- [x] Manual workspace-scoped evidence ledger for crawler fetch, indexing, citations, training attestations, and referrals.
- [ ] Add authenticated CDN/server log ingestion and provider-published crawler IP validation.
- [ ] Add Search Console/Bing Webmaster OAuth adapters, canonical/robots/sitemap/schema audits, and AI-answer citation sampling.
- [ ] Add alerting, evidence retention, and domain ownership controls.
- Acceptance: crawler fetch, indexing, citation, and training remain separate evidence types with independent proof requirements.

### 10. Identity, tenancy, jobs, and durable data
- [ ] Replace the shared admin token as the production identity layer with authenticated users, roles, sessions, and workspace membership.
- [ ] Bind every task, asset, credential, job, and destination to an authorized workspace identity.
- [ ] Replace single-process local JSON for production with transactional shared persistence and migrations.
- [ ] Add durable jobs, retries, idempotency, dead-letter handling, audit events, and recovery.
- [ ] Add secret management, encryption-at-rest, key rotation, rate limiting, security headers, monitoring, backups, and restore tests.
- Acceptance: concurrent multi-user tests, tenant-isolation tests, recovery tests, and security review pass before production deployment.

### 11. End-to-end acceptance and release
- [ ] Test the full lifecycle: create brief → search → register sources → review evidence → outline → draft → originality → media → approve → CMS draft → preview → explicit publish → external verification.
- [ ] Test magazine pitch creation, approval, authorized handoff, editor response, acceptance, and external publication verification.
- [ ] Test social variants, account authorization, scheduled publishing, and remote post reconciliation.
- [ ] Test failure paths: quotas, invalid credentials, timeouts, duplicate requests, access denied, session expiry, partial publish, and external rollback/reconciliation.
- [ ] Run responsive, accessibility, performance, dependency, secret, and security checks.
- Acceptance: green CI and documented live acceptance evidence for each enabled destination. Any connector without credentials or an authorized target remains clearly marked as not live-enabled.

## External prerequisites that code cannot supply

1. Search provider account/key and approval to make live search requests.
2. An authorized model endpoint/key, or a scoped MAAROOF AI integration contract, before model-generated writing and NER can run.
3. A user-owned WordPress or Ghost test site and scoped application credentials.
4. OAuth app credentials and test accounts for each selected social network.
5. The original magazine list and any private submission routes/rules that are not publicly documented.
6. Workspace-owned domain access, CDN/server logs, and OAuth consent for Search Console/Bing.
7. A production hosting environment, secret store, persistent database, and operator approval for deployment.

No external prerequisite is assumed to exist until it is provided and verified.
