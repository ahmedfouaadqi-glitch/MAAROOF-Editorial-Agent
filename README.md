# MAAROOF Editorial Agent

Lovable-compatible editorial production and verified publishing platform.

## Architecture constraints
- Frontend: React + Vite + TypeScript, Tailwind CSS, React Router.
- Database/authentication: intentionally deferred in the current implementation track. Supabase is not being configured in this phase.
- Application services: independent Node.js REST services and durable jobs (planned; not implemented yet).
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
- Admin UI draft for configuring per-article Firecrawl crawl URL, search, and inspection limits (3 / 5 / 5 defaults).
- Provider-neutral research budget ledger with independent per-task counters, pre-call reservation, limit blocking, and failed-call release.

## Platform registry policy
The 17 listed entries are not all magazines. The registry separates editorial destinations, professional networks, communities, encyclopedic knowledge bases, research repositories, code hosts, and data sources. A listed platform is not presumed to accept promotional articles or automated publishing.

Official APIs are preferred where appropriate and authorized. Browser automation is considered only after platform-specific policy review and controlled testing. Manual handoff remains available for destinations where automated publishing is unsupported or inappropriate.

## Deliberately not implemented yet
- Supabase, database persistence, authentication, and RLS (deferred per current implementation instruction).
- Live AI model calls, paid research, and provider credentials.
- Durable server-side storage and atomic cross-worker enforcement for research budgets; the current admin controls are session-local UI state and are not yet production enforcement.
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
