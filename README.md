# MAAROOF Editorial Agent

Lovable-compatible editorial production and verified publishing platform.

## Architecture constraints
- Frontend: React + Vite + TypeScript, Tailwind CSS, React Router.
- No Supabase or managed database is used. The current API prototype persists JSON locally.
- Application service: independent Node.js HTTP API with serialized, atomic single-process JSON writes. It is not horizontally scalable.
- Browser publishing: isolated Playwright + Chromium runtime (planned; not implemented yet). Browser automation must never run in the frontend.
- AI: provider-agnostic gateway (planned). No paid model calls are made by the current foundation.
- MAAROOF AI remains a separate system; integration is through scoped, authenticated APIs only.

## Current implementation
- Responsive Linear-inspired editorial workspace with a vector-first dashboard, Arabic RTL default, English shell labels, light/dark themes, and mobile navigation.
- Integrated the official React Bits SpotlightCard component for restrained pointer-reactive lighting; no React Bits Pro assets or additional animation dependencies.
- Conservative platform capability profiles, policy constraints, and verification checklists.
- Editorial workflow TypeScript contracts and deterministic draft structure validation.
- Article task creation, listing, and controlled stage progression through the standalone Node API.
- Fail-closed publishing gate; no platform is currently publish-enabled.
- Admin UI for per-article manual source URL, search-operation, and inspection-operation limits (defaults 3 / 5 / 5).
- Standalone Node.js API with admin bearer-token protection and local JSON persistence.
- Workspace-scoped article research counters, idempotent reservations, commit/release operations, and source URL registration.
- Manual source URLs are stored with title/notes and provenance. Their contents are not fetched or verified.
- Article-level evidence workspace: manually register references, add factual claims, and link claims only to sources from the same workspace and article.
- Claim coverage reports source-link completeness only; linked sources remain unverified until an evidence review is implemented.
- Deterministic originality baseline: normalized SHA-256 exact-match checks and token-overlap near-match heuristics against text previously submitted in the same workspace.

See [API route documentation](docs/API.md) for task creation, source registration, research reservations, and admin configuration. See [UI design system](docs/UI-DESIGN-SYSTEM.md) for the visual system and [React Bits integration notes](src/components/SpotlightCard.LICENSE.md) for component attribution and license.

## Explicit exclusions
- Supabase and managed database services.
- Firecrawl, automated crawling, remote URL fetching, and scraping services.
- No live search or inspection provider is connected. The API currently enforces quotas for these future provider operations only.
- Paid model calls and provider credentials.
- Real publishing adapters, Playwright runtime, MAAROOF AI integration, and external publication verification.

## Local development
Requires Node.js 22 or newer.

1. Copy `.env.example` to `.env`.
2. Set a strong, unique `ADMIN_API_TOKEN` in `.env`.
3. Start the API:

```bash
npm install
npm run server
```

4. In a second terminal, start the frontend:

```bash
npm run dev
```

5. Validate the project:

```bash
npm run typecheck
npm test
npm run build
```

The API defaults to `http://127.0.0.1:8787`. Set `HOST=0.0.0.0` only when the service must accept connections from outside the local host, and configure `CORS_ORIGIN` to the exact frontend origin. The JSON data file is written to `./data/editorial-agent.json` and is excluded from Git.

## Security and scaling limitations
- The shared admin bearer token is an interim operator gate, not user identity authentication. Do not expose it in a public frontend bundle or use it as a production multi-tenant auth model.
- Workspace identifiers are scoped in records, but a real authenticated identity-to-workspace authorization layer is still required before production.
- The JSON store serializes writes within one Node process only. Run exactly one API instance against a given data file; multiple processes/replicas require a transactional shared store.
- Keep secrets out of source control and model prompts.
- Never bypass CAPTCHA, MFA, access controls, or platform safeguards.
- Never report publication success without external verification.
- Do not use research repositories, Q&A communities, or data archives as generic promotional publishing destinations.

## Research acquisition policy
No Firecrawl or automated crawler is used. Source URLs are manually registered and are not fetched. Search and inspection quotas are reserved by backend API endpoints, but no live search or inspection provider is currently connected.

### Entity intelligence baseline
- Register article-scoped people, organizations, places, products, events, concepts, or unknown entities with aliases and a disambiguation note.
- Match registered aliases against claim text and link matching claims to entities.
- Record explicit directed relationships between entities and optionally attach claim IDs as unverified support.
- Current matching is deterministic alias matching, not automatic named-entity recognition or global identity resolution.


### Editorial research baseline
- Record source metadata, publication and effective dates, methodology, jurisdiction, and a reasoned manual quality assessment.
- Attach manually transcribed excerpts to claims with explicit supporting, contradicting, contextual, or unclear stances.
- Surface conflicting evidence at claim level without automatically deciding which source is correct.
- Metadata completeness is not source reliability; all evidence remains manually recorded and unverified until independently checked.

## Publishing destination registries
- [Magazine and editorial publication registry](docs/MAGAZINE-PUBLICATION-REGISTRY.md) and its machine-readable catalogue at `config/magazine-publication-registry.json`.
- [Platform-native social publishing](docs/PLATFORM-NATIVE-SOCIAL-PUBLISHING.md) and its machine-readable catalogue at `config/social-platform-catalog.json`.
- Editorial magazines, self-publishing systems, CMS products, social networks, communities, research repositories, and data sources are maintained as distinct destination types. Candidate listing does not imply an active adapter or publication permission.
