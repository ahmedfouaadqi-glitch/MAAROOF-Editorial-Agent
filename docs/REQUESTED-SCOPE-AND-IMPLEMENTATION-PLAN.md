# MAAROOF Editorial Agent — Requested Scope and Implementation Plan

**Status:** Active implementation plan  
**Frontend target:** Lovable-compatible React + Vite + TypeScript  
**Execution model:** Independent Node.js API + isolated Playwright/Chromium browser worker  
**Persistence:** No Supabase. Replace the current single-process JSON prototype before production use.  
**Article-writing LLM:** Deferred; no model-provider call is part of the current delivery.

## 1. Product definition

Build an independent editorial operations agent that prepares, researches, validates, manages and publishes original bilingual articles to supported editorial destinations. The browser agent must operate a real remote browser, pause for the user to sign in when required, resume the same job, enter article content and contextual images, and verify the external result.

This is not a WordPress/Ghost API integration project. WordPress, Ghost and other destinations are managed through a destination registry and the browser workflow where allowed. Use an official API only when a particular destination has an approved, documented and useful API path; do not create separate CMS adapters as the main publishing architecture.

## 2. Non-negotiable constraints

- Keep React + Vite + TypeScript, Tailwind, React Router and the existing Lovable/GitHub-compatible frontend. No Next.js.
- Do not use Supabase for database, authentication, storage or RLS.
- Keep the browser automation runtime outside the frontend and run it in an isolated Node.js worker with Playwright + Chromium.
- Do not send browser credentials or model keys to the frontend. Encrypt session material at rest and scope it to a workspace and destination account.
- Keep workspace, client and brand boundaries explicit in every record and server-side operation.
- Do not call an LLM to write articles in this phase. Keep the provider boundary optional and disabled.
- Do not bypass CAPTCHA, MFA, login challenges, editorial approval, robots/access restrictions or platform safeguards. Use user handoff.
- Do not report a successful publication based only on a click or local status. Verify the external URL or destination record.
- No external publication test without explicit operator approval.

## 3. Destination list and classification

The supplied CSV contains 17 platforms. Preserve all 17 records, but classify them by purpose instead of treating every platform as a magazine.

| Class | Destinations | Default handling |
|---|---|---|
| Self-publishing / newsletters | Medium, Substack | Browser workflow; destination-specific account and publication rules |
| CMS / owned publishing site | WordPress, Blogger, Ghost | A site-specific browser profile; each site is a separate destination |
| Professional / developer long-form | LinkedIn Articles, DEV Community, Hashnode | Browser workflow only after current article/publishing capability and policy checks |
| Communities / Q&A | Reddit, Quora, Stack Exchange | Not generic magazine targets; use only when the content genuinely answers or contributes to a relevant discussion |
| Encyclopedia / scholarly repositories | Wikipedia, arXiv, PubMed Central | Exclude from generic promotional auto-publishing; require their own eligibility, neutrality, scholarly or editorial process |
| Code / web data / datasets | GitHub, Common Crawl, Hugging Face Datasets | Not generic article destinations; use only for suitable code, documentation, archives or datasets |

The current candidate registry additionally lists HackerNoon, DZone, The Gulf Magazine, DAWN Prism, I by IMD and +972 Magazine. These are candidates, not guaranteed acceptance or verified live integrations. Recheck each publication's current editorial rules, content fit, rights, exclusivity, submission method and account requirements before enabling automation.

A destination profile must contain: canonical name/domain, type, language, region, subject areas, audience, official guideline URL, last-checked date, submission route, pitch-first requirement, accepted formats, word limits, image rules, citation/source rules, exclusivity, rights/licensing, author bio, account/workspace owner, browser selectors or adapter version, test status, and external verification method.

## 4. Reuse audit: MAAROOF AI PostSuggester

Reviewed in the MAAROOF AI repository:
- `src/components/PostSuggester.tsx`
- `src/routes/api/suggest.ts`
- `src/lib/tokens.server.ts`
- `src/lib/mci/resolver.server.ts`
- `src/lib/mci/context-selector.ts`
- `src/lib/mci/evidence-gate.ts`
- `src/lib/mci/freshness-gate.ts`
- `docs/MCI_AUDIT.md`

### Reuse / extend / adapt / exclude decisions

| Capability | Decision | Application to Editorial Agent |
|---|---|---|
| Language, content goal, length and output controls | Adapt | Article language, objective, publication format, audience and editorial depth |
| Market and geographic scope | Reuse concept | Country/region/audience context becomes explicit article input |
| Factual-safety prompt discipline | Adapt | No unsupported facts, invented numbers, quotations, interviews or credentials; each factual claim must map to evidence or be clearly marked |
| GEO scoring rubric | Adapt, do not copy blindly | Evaluate named entities, grounded claims, answerability, context, unique angle and citation-ready structure; no keyword stuffing |
| Platform-specific content variants | Adapt | Each publication receives its own editorial brief, structure, word count and submission package |
| Uploaded image/video input | Adapt | Editorial media library, contextual image placement, captions, alt text and rights metadata |
| Auth and workspace guard | Build equivalent in this project | Never import MAAROOF AI Supabase client or bypass its authorization model |
| Token charging / usage ledger | Defer model-specific reuse | Add provider-neutral metering only when paid model generation is enabled |
| MCI context selection and freshness/evidence gates | Reuse concepts only | Preserve provenance, freshness and evidence-first decisions. Do not build a second MCI or claim PostSuggester itself uses MCI |
| Direct `/api/suggest` and short-post prompt | Exclude as-is | It is a social-post generator, not an article research, originality or publishing workflow |

The audited suggest route uses a model-selection step, token charging, a market-aware system prompt, language/platform/goal conditioning, factual-safety rules and a conservative GEO rubric. The component accepts text/image/video input, article/post mode and output language/platform choices. The current MCI audit marks `suggest` as not applicable to MCI. The editorial system should reuse these proven design patterns without copying the social-post implementation or importing its Supabase dependencies.

## 5. Editorial workflow

1. Select workspace, client, brand, language, market, audience and publication destination(s).
2. Retrieve only authorized brand/workspace context supplied in the editorial workspace; future MAAROOF AI context is obtained through a scoped API, not direct database access.
3. Discover suitable article themes and angles using known brand facts, target publication fit, audience questions, market context and available evidence.
4. Search and fetch a bounded set of sources; record provenance, timestamp and verification state.
5. Build a GEO/SEO/AEO content brief: entities, entity relationships, search intent, question set, semantic topic cluster, evidence-backed claims and citation opportunities.
6. Create the article structure and editable draft scaffold. Human-authored content is supported in this phase; LLM article writing is deferred.
7. Check duplicate risk against workspace, client, brand and destination history before the article can proceed.
8. Add user-uploaded or appropriately licensed media; assign images to semantically relevant sections and preserve credits, captions, rights and alt text.
9. Run editorial, source, originality and media checks; collect the required approval.
10. Start the browser publishing job for the selected destination. Pause for login/MFA/CAPTCHA/user action where needed, then resume.
11. Enter the title, body, images, categories, tags, author details and required disclosures. Preview and follow the destination's submission/publication policy.
12. Verify the external outcome and store the external URL/ID, timestamp, screenshots where appropriate, status and execution log.

The interface exposes each state: planning, researching, source review, GEO analysis, outline, drafting, duplicate review, media preparation, editorial approval, waiting for login, publishing, verifying, completed, failed or user action required.

## 6. GEO intelligence requirements

GEO is not a list of repeated keywords and a single unverified score. The article brief should be evidence-led and include:
- primary entity and unambiguous entity description;
- related people, organizations, places, products, concepts and relations;
- market, geography, audience and language;
- user questions and search intent;
- semantic topic cluster and related terms;
- evidence-backed answer blocks, definitions, comparisons and FAQs where editorially appropriate;
- citations or source references attached to relevant claims;
- a distinct editorial angle for each destination and article campaign.

Return separate diagnostic dimensions: entity coverage, evidence coverage, answerability, source quality, freshness, structure, language suitability and editorial distinctiveness. A composite GEO readiness score must disclose its rubric and missing inputs; it must not be described as measured visibility in AI answers.

## 7. Limits and Firecrawl governance

The administrator can configure per-article quotas. Initial defaults:
- Firecrawl URL scrapes: **3 URLs per article**.
- Search operations: **5 per article**.
- Inspection/verification operations: **5 per article**.
- Existing manual source registration allowance remains a distinct setting and must not be mistaken for a scrape.

All limits are server-enforced and workspace/task scoped. Reserve quota atomically before a provider operation; commit after an attempted operation and release only when the operation definitively did not start. Idempotency keys prevent accidental double charging on retries. Show used, remaining and configured units in the article UI and admin settings.

Firecrawl is an optional server-side provider. It remains disabled unless the server has a key and the administrator enables it. Use the v2 search and scrape endpoints, bound request/response sizes and timeouts, normalize results, and label raw search/scrape output as unverified until editorial evidence review. Do not call Firecrawl from the browser or expose its key. Never perform unrestricted whole-site crawls for an article; only the configured number of selected URLs may be scraped.

## 8. Originality and repetition prevention

Check across all articles associated with the same workspace, client, brand and destination, including drafts, scheduled, submitted and published content. Use:
- normalized exact hash;
- lexical near-duplicate similarity;
- title/angle/topic/entity overlap;
- cross-language comparison when a suitable multilingual similarity component is added.

Same-brand topic overlap alone is not a duplicate. Detect repeated article substance, argument, structure or angle. In the current non-LLM phase, report deterministic match signals and route uncertain cases to human review; do not claim semantic or cross-language detection is fully implemented until separately validated.

## 9. Browser Agent

The browser worker is a separate Node.js service:
- Playwright + Chromium, isolated job contexts and destination-specific adapters;
- user-visible remote browser session or controlled browser handoff;
- login state detection and secure pause/resume;
- explicit user intervention for login, MFA and CAPTCHA;
- robust selectors, screenshots and step logs;
- upload/insert images, set metadata and preview;
- safe retry and idempotency to avoid double submission;
- external publication/submission verification.

The worker must respect destination policies. For editorial magazines that require a pitch or editor decision, the job submits the pitch/manuscript through the allowed route and records `submitted`; it does not assume acceptance or publication. Do not use WordPress/Ghost REST adapters as a separate target for this scope unless the destination's own policy and an explicit product decision justify one.

## 10. Persistence, identity and deployment without Supabase

The present local JSON store is a single-process prototype and is not a production multi-workspace database. Before production:
- select a standalone relational database (PostgreSQL is the preferred target) with migrations, transactions, indexes and backups;
- implement real user authentication, workspace memberships, roles and server-side authorization;
- isolate records, assets, browser sessions and job queues by workspace;
- encrypt provider credentials and browser session state using deployment-managed encryption keys;
- use durable jobs and a separate worker process;
- use object storage compatible with an S3 API or an owned storage service for media and artifacts;
- keep the Vite frontend deployable through Lovable/GitHub without putting browser execution or secrets in the frontend.

## 11. Planned delivery phases

| Phase | Deliverable | Acceptance condition |
|---|---|---|
| 1. Repository and reuse audit | This audit and the platform/destination classification | Reuse decisions documented; no MAAROOF AI code copied or altered |
| 2. Lovable-compatible foundation | React/Vite UI, bilingual RTL/LTR shell, vector/Linear visual system and React Bits components | Lovable-compatible build; no Next.js or Supabase |
| 3. Workspace and editorial data | Workspace/client/brand/article contracts and secure persistence path | Cross-workspace access tests pass |
| 4. Research + Firecrawl | Configurable quotas, live search, bounded scraping, source provenance and evidence records | Defaults 3/5/5 enforced server-side; disabled/no-key mode fails closed |
| 5. GEO and editorial planning | Entity/context/topic/question/angle/brief/outline engines | Outputs explain evidence, provenance and missing facts |
| 6. Originality + media | Duplicate signals and contextual media handling | No cross-workspace leakage; human review for uncertain matches |
| 7. Browser publishing | Isolated Playwright worker, login handoff, destination adapters and recovery | One approved destination completes an externally verified test |
| 8. Publishing control | Approval, scheduling, jobs, idempotency, audit and result verification | Retries do not duplicate posts; outcomes reconciled with destination |
| 9. MAAROOF AI API | Scoped authenticated endpoints and future workspace-context exchange | API scope and audit tests pass; no direct database coupling |
| 10. Production acceptance | Security, backup, restore, concurrency, load and end-to-end tests | Full article-to-external-publication lifecycle passes |
| Deferred: AI article writing | Provider-agnostic model gateway and evidence-constrained writing | Implement only after explicit activation decision and provider/cost setup |

## 12. Current repository reality

Already present on the active feature branch:
- React + Vite + TypeScript frontend and original yellow-and-black vector-first editorial layout, with Linear-like clarity but no copied assets or screen design;
- Arabic RTL default and English shell;
- React Bits SpotlightCard integration;
- initial platform and magazine registries;
- article tasks, outlines, manual editing, source/evidence records, entity registry, originality baseline, media review and approval gates;
- standalone Node API with workspace-scoped task records and local JSON persistence;
- configurable defaults for source URLs/search/inspection at 3/5/5;
- optional Brave search adapter;
- optional model-writing adapter, disabled by default.

Still missing or not end-to-end verified:
- Firecrawl adapter and actual scrape quota;
- authenticated multi-workspace identity and production persistence (no Supabase);
- real NER/entity resolution and validated GEO evaluation;
- semantic and cross-language duplicate detection;
- complete media upload and contextual placement pipeline;
- isolated Playwright/Chromium browser worker and login handoff;
- tested destination-specific publishing adapters and external verification;
- durable background jobs, recovery, audit/monitoring and API integration with MAAROOF AI.

**Important:** A registry entry, adapter contract, saved local state or passing unit test does not prove a real external publication. Keep all destinations disabled for automatic publication until a destination-specific test has been approved and verified.
