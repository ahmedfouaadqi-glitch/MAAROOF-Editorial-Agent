# MAAROOF Editorial Agent

Lovable-compatible editorial production and verified publishing platform.

## Architecture constraints
- Frontend: React + Vite + TypeScript, Tailwind CSS, React Router.
- No Supabase or managed database is used. Local JSON persistence is used for the current single-process API prototype.
- Application service: independent Node.js HTTP API with atomic single-process JSON persistence (implemented prototype; not horizontally scalable).
- Browser publishing: isolated Playwright + Chromium runtime (planned; not implemented yet). Browser automation must never run in the frontend.
- AI: provider-agnostic gateway (planned). No paid model calls are made by the current foundation.
- MAAROOF AI remains a separate system; integration is through scoped, authenticated APIs only.

## Current implementation
- Arabic RTL dashboard shell.
- Searchable and filterable registry for the 17 platforms supplied by the user.
- Platform profiles with conservative capability declarations, policy constraints, official documentation links where identified, and per-platform verification checklists.
- Editorial workflow TypeScript contracts for intake, planning, research, entity analysis, drafting, evidence review, originality review, media review, editorial approval, publishing, and publication verification.
- Fail-closed publishing gate: registry metadata cannot authorize publishing. Every adapter remains blocked until implementation, policy, account, credentials, human approval (when required), and idempotency checks pass.
- Vitest test cases for registry completeness, fail-closed publishing behavior, and per-article research budget enforcement.
- Admin UI for configuring per-article manual source URL, search-operation, and inspection-operation limits (3 / 5 / 5 defaults), saved through the standalone API.
- Standalone Node.js HTTP API with local JSON persistence, authenticated admin settings, workspace-scoped task budgets, idempotent reservations, atomic source-reference registration, quota blocking, and reservation commit/release.

## Platform registry policy
The 17 listed entries are not all magazines. The registry separates editorial destinations, professional networks, communities, encyclopedic knowledge bases, research repositories, code hosts, and data sources. A listed platform is not presumed to accept promotional articles or automated publishing.

Official APIs are preferred where appropriate and authorized. Browser automation is considered only after platform-specific policy review and controlled testing. Manual handoff remains available for destinations where automated publishing is unsupported or inappropriate.

## Deliberately not implemented yet
- Supabase (explicitly excluded).
- Automated web crawling, Firecrawl, and external search/inspection provider integrations (explicitly excluded/not configured).
- Live AI model calls, paid research, and provider credentials.
- Multi-instance durable database, user identity authentication, and cross-process quota coordination; current JSON persistence is single-process and admin-token protected.
- Real platform publishing adapters.
- Playwright browser runtime and persistent authenticated sessions.
- MAAROOF AI API integration.
- External publication verification.

## Local development
```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Safety and reliability
- Never bypass CAPTCHA, MFA, access controls, or platform safeguards.
- Never report publication success without external verification.
- Use idempotency and publication reconciliation to prevent duplicate submissions.
- Keep credentials and API secrets out of model prompts and frontend bundles.
- Do not enable a platform adapter until its policy, account access, and end-to-end behavior have been verified.
- Do not use research repositories, Q&A communities, or data archives as generic promotional publishing destinations.
\n## Research acquisition policy\n\nNo Firecrawl or automated crawler is used. Source URLs are registered manually and are not fetched. Search and inspection quotas are reserved by backend API endpoints, but no live search or inspection provider is currently connected.\n