# MAAROOF Editorial Agent

Lovable-compatible editorial production and verified publishing platform.

## Architecture constraints
- Frontend: React + Vite + TypeScript, Tailwind CSS, shadcn/ui, React Router.
- Data and identity: Supabase PostgreSQL, Auth, Storage, and RLS.
- Application services: independent Node.js REST services and durable jobs.
- Browser publishing: isolated Playwright + Chromium runtime; never run browser automation in the frontend.
- AI: provider-agnostic gateway. No paid model calls in tests without explicit approval.
- MAAROOF AI remains a separate system; integration is through scoped, authenticated APIs only.

## Initial implementation status
This repository was empty at project start. This commit initializes the project documentation only. The implementation is staged on a dedicated feature branch after initialization.

## Platform registry policy
Platforms are classified by their actual publishing workflow and content purpose. A platform being listed does not imply that it accepts promotional articles or supports automated publishing. Official APIs are preferred; browser automation is enabled only after platform-specific validation and policy review. Manual handoff is supported.

## Safety and reliability
- Never bypass CAPTCHA, MFA, access controls, or platform safeguards.
- Never report publication success without external verification.
- Use idempotency and publication reconciliation to prevent duplicate submissions.
- Encrypt browser session material and keep credentials away from model prompts.
- Enforce workspace scoping in APIs and database RLS.
