# MAAROOF Editorial Agent

Lovable-compatible editorial operations platform with a future browser-first publishing agent.

## Architecture constraints
- Frontend: React + Vite + TypeScript, Tailwind CSS, React Router.
- No Supabase. The current API prototype persists JSON locally.
- Application service: independent Node.js HTTP API with serialized, atomic single-process JSON writes. It is not horizontally scalable.
- Browser publishing: isolated Playwright + Chromium runtime is planned and not implemented yet. Browser automation must never run in the frontend.
- Article-writing LLM use is deferred. The existing optional model adapter remains disabled by default and is not part of the current operating phase.
- MAAROOF AI remains a separate system; future integration is through scoped, authenticated APIs only.

## Current implementation
- Responsive Linear-inspired editorial workspace with vector-first dashboard, Arabic RTL default, English shell labels, light/dark themes, and mobile navigation.
- React Bits SpotlightCard integration for restrained pointer-reactive lighting.
- Conservative platform capability profiles, policy constraints, and verification checklists.
- Article task creation, deterministic Arabic/English outline scaffold, human editing, and controlled stage progression.
- Article-level source/evidence workspace, claim links, entity registry, manual source assessment, and editorial/media approval gates.
- Deterministic exact-match and token-overlap originality baseline; this is not semantic plagiarism detection.
- Admin quotas per article: manually registered source URLs 3, Firecrawl page scrapes 3, search operations 5, and structure inspections 5 by default.
- Optional Firecrawl v2 server adapter, quota-metered scrape/search APIs, extracted Markdown storage, and unverified provenance.
- Optional Brave Web Search adapter behind server-side configuration.
- Structure inspection of scraped Markdown: word count, headings and inline links. It does not establish factual accuracy.
- Local JSON persistence, workspace/task scoping and an interim shared admin bearer-token gate.

See the [requested scope and implementation plan](docs/REQUESTED-SCOPE-AND-IMPLEMENTATION-PLAN.md), [API documentation](docs/API.md), [magazine registry](docs/MAGAZINE-PUBLICATION-REGISTRY.md), and [UI design system](docs/UI-DESIGN-SYSTEM.md).

## Explicit exclusions and deferred work
- Supabase and managed database services.
- Model-based article writing, model-assisted NER and paid LLM calls until a later phase.
- Real browser publishing, Playwright/Chromium worker, account-session handoff, and external publication verification.
- Production identity authentication, durable multi-instance persistence, and production job orchestration.
- No destination is automatically publish-enabled. Destination policy and account authorization must be verified individually.

## Research provider configuration
- Set FIRECRAWL_API_KEY on the server to enable page scraping.
- Set RESEARCH_SEARCH_PROVIDER=firecrawl to use Firecrawl Search with the same server-side key.
- Alternatively set RESEARCH_SEARCH_PROVIDER=brave and BRAVE_SEARCH_API_KEY to use Brave Search.
- Search and scrape outputs remain unverified. A scraped page is a retrieved source, not proof of truth.
- The admin can set per-article quotas. Defaults are 3 page scrapes, 5 search operations and 5 structural inspections. Manual reference registration has its own separate limit.

No provider key is sent to Vite or the browser. Tests use mocked providers and do not execute live paid calls.

## Local development
Requires Node.js 22 or newer.

1. Copy .env.example to .env.
2. Set a strong, unique ADMIN_API_TOKEN.
3. Start the API with npm install and npm run server.
4. In a second terminal, run npm run dev.
5. Validate with npm run typecheck, npm test and npm run build.

The API defaults to http://127.0.0.1:8787. Set HOST=0.0.0.0 only when external access is required, and configure CORS_ORIGIN to the exact frontend origin. The JSON data file is written to ./data/editorial-agent.json and excluded from Git.

## Security and scaling limitations
- The shared admin bearer token is an interim operator gate, not production identity authentication.
- Workspace identifiers are currently record-scoped; authenticated identity-to-workspace authorization is required before public multi-tenant deployment.
- JSON persistence serializes writes within one Node process only. Do not run multiple instances against the same data file.
- Firecrawl fetches remote URLs. Current validation rejects local/internal hostnames and literal IP targets, but is not a complete DNS-rebinding defence; stricter destination and provider-side controls remain necessary.
- Keep secrets out of source control and frontend bundles.
- Never bypass CAPTCHA, MFA, access controls or platform safeguards.
- Never report publication success without external verification.
- Do not use research repositories, Q&A communities, encyclopedias or data archives as generic promotional publishing destinations.

## Platform classification
The supplied 17-entry seed list is preserved, but not all entries are magazines:
- Self-publishing/CMS: Medium, Substack, WordPress, Blogger, Ghost.
- Developer/professional long-form: DEV Community, Hashnode, LinkedIn Articles.
- Communities/Q&A: Reddit, Quora, Stack Exchange.
- Encyclopedia/research repositories: Wikipedia, arXiv, PubMed Central.
- Code/data/archive destinations: GitHub, Common Crawl, Hugging Face Datasets.

Additional editorial candidates are documented in the separate magazine registry. Candidate listing does not imply a working adapter, permission or guaranteed editorial acceptance.

## Editorial truth rules
- Search discovery is not source verification.
- Scraped content is not a verified claim.
- A source link is not proof that the source supports a claim.
- A local originality no-match is not proof of originality.
- Submission is not acceptance; acceptance is not publication.
- A click is not proof of external publication.
- Each destination requires a current policy check and a verified account/submission route before automation is enabled.
