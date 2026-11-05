# Agent-First Editorial Workspace — Implementation Contract

## Product decision

The product is a task-executing editorial agent, not an editorial administration suite. The default and primary surface is one conversation. The user describes the desired outcome and may attach text, images, video, documents, spreadsheets, or URLs. The agent plans and performs the work, reports observable progress, presents a reviewable result, and waits for explicit approval before any final publish/submit action.

## User-facing information architecture

Only these persistent destinations are allowed:
1. **Conversation** — the default workspace and the single entry point for requests, attachments, execution progress, review, and browser handoff.
2. **History** — previous conversations and their task/result state.
3. **Workspaces** — create, rename, switch, and archive independent workspaces. Each workspace has isolated conversations, files, brand context, destinations, and memory.

Do not expose administration dashboards, analytics dashboards, SEO tool pages, registries, libraries, research settings, or separate skill/tool catalogs as primary navigation. Specialized capabilities are invoked internally from conversation context.

## Non-negotiable execution and safety rules

- Browser work must use the existing isolated Playwright/Chromium worker, not the user's personal Chrome session.
- The agent must support real navigation, page inspection, scrolling, link navigation, form interaction, text entry, upload controls, and waiting for page state changes.
- Restrict navigation to user-authorized HTTPS destinations; enforce DNS/IP protections and revalidate redirects/navigation targets.
- Never bypass CAPTCHA, MFA, paywalls, access controls, robots restrictions, or site terms. Pause for the user when authentication or a human challenge is required.
- The agent may prepare and fill a publishing form, but must stop before any irreversible submit/publish action.
- Approval must bind to the exact reviewed content version, destination, and action. Any content or destination change invalidates the approval.
- No tool may publish, submit, send, or schedule content without a fresh explicit user confirmation.
- Do not report a successful publication unless independently verified from the destination after the action.
- No paid research or media-provider operation without server-side cost estimation and user authorization where applicable.
- Secrets, browser cookies, and credentials remain server-side; never persist passwords or expose browser-worker tokens to the frontend.

## Existing foundation to preserve

The repository already uses React, Vite, TypeScript, Node.js ESM, a JSON file store, Playwright, and an OpenAI-compatible server-side model provider. Existing useful capabilities include:
- conversation history and task progress;
- attachment upload and local extraction for PDF/DOCX/TXT;
- image and video attachment handling with current limitations;
- editorial drafting and destination adaptation;
- editorial intelligence, originality screening, and media metadata analysis;
- research provider abstractions and optional Firecrawl/Brave adapters;
- isolated browser worker and a fail-closed approval gate.

Do not replace these systems wholesale. Extend their contracts and tests. Do not add Supabase or Next.js. Do not expose the old multi-section product navigation.

## Target architecture

### 1. Conversation Orchestrator
Parse the user's request, identify intent, language, workspace context, attachments, destination, constraints, and required outcome. Produce a structured plan and execute only the required steps. Keep the user informed with real step states; never display a step as completed when it was skipped or merely planned.

### 2. Workspace Context
Replace the single hard-coded workspace assumption with real workspace CRUD and ownership boundaries. Every conversation, attachment, draft, source, browser destination/session, approval, and memory record must carry workspaceId. A workspace switch must not leak context or files.

### 3. Multimodal Intake
Create a typed attachment pipeline:
- images: validate, preview, and send image content to a capable vision model when configured;
- video: extract frames and, where supported, audio/transcription; report exactly which modalities were analyzed;
- PDF/DOCX/TXT/Markdown: extract text and preserve document metadata;
- XLSX/CSV: parse sheets/tables and provide structured context;
- unsupported formats: explain what is unsupported rather than pretending they were analyzed.
All extraction is bounded by file size, page/frame count, token budget, and workspace ownership.

### 4. Research and Evidence
Use provider-neutral search and scrape adapters. Store URL, title, publisher, retrieval time, excerpts, acquisition method, and verification status. Distinguish search snippets, fetched page content, primary evidence, and independently corroborated claims. Fact-check material claims before presenting a publication-ready draft. Keep paid calls gated.

### 5. Editorial and GEO Engine
Select writing strategy dynamically from task intent, audience, language, market, publication format, brand voice, and evidence. Use relevant skill guidance as internal playbooks, not rigid templates. GEO/SEO/AEO recommendations must be contextual and evidence-aware; do not use a universal formula, keyword-density target, guaranteed ranking, or invented visibility score.

### 6. Browser Agent
Extend the current browser worker into a controlled agent loop:
- open a new isolated browser context/page;
- navigate to an approved target;
- inspect DOM/accessibility structure and visible content;
- scroll and follow links within the authorized host policy;
- interact with forms and file inputs;
- capture screenshots and structured observations;
- detect login/challenge/error states and pause safely;
- keep a trace of actions and observations;
- require a final approval token bound to content hash + destination + operation before submission is even enabled.
Prefer accessible locators and semantic controls; use selectors only as a fallback. Do not treat screenshot-only coordinate clicking as the default.

### 7. Publish Gate
Model states explicitly: draft -> review-required -> approved-for-specific-action -> submitted -> independently-verified (or failed/unknown). Approval is single-use, short-lived, and invalidated by edits. The agent must stop before submit and request a clear confirmation showing destination, content version, and action.

### 8. History and Memory
History is conversation-centric. Workspace memory stores only useful, scoped facts such as brand voice, preferred terminology, target audiences, and approved destinations. Provide provenance and allow users to correct workspace context. Never blend memories across workspaces.

## Skill intake policy — 80 ZIP archives / 69 unique skill names

The uploaded archives contain repeated versions and duplicated packages. Merge by capability, not by archive count. Inspect the complete SKILL.md, references, scripts, assets, licenses, runtime assumptions, and evaluation files before importing any skill.

### Include in the editorial agent capability set
- content creation, content strategy, copywriting, copy editing, grammar checking, blog writing, blog rewriting, blog translation/localization, blog repurposing;
- alternative articles, listicles, comparison articles;
- GEO/AI SEO, SEO/AEO practices, SEO audits, SEO competitor analysis, keyword research, content-gap analysis, programmatic SEO, ASO audit and app metadata optimization when the requested destination is an app store;
- search strategy, research synthesis, market research, account/company research, competitive intelligence, YouTube/video research, fact-checking, source/evidence synthesis;
- brand guidelines, workspace memory management, humanization/style cleanup, content modeling;
- product campaign and UGC workflow only when required media-generation providers and licenses are available;
- content experimentation and A/B testing as post-publication optimization guidance.

### Conditional / internal-only
- parallel-agent dispatch and agent-development patterns: internal orchestration guidance, not user-visible features;
- marketing ideas/psychology, pricing strategy, business model, market sizing, outreach: invoke only when the requested content task requires them;
- KPI design: use measurement concepts internally; do not add a KPI dashboard;
- Manim: only for explicit explanatory animation requests and only when its runtime is installed;
- Obsidian formats/canvas: only for explicit export requests;
- PRD/README/task-management playbooks: engineering/documentation utilities, not editorial product capabilities.

### Exclude from the editorial runtime
- threat hunting/security operations, portfolio risk/backtesting/trading, SOX audit support, churn-prevention workflows, legal-risk assessment as a legal conclusion, call preparation, cover letters, OS settings playbooks, and unrelated personal productivity tools.

### Deduplication rules
- Compare duplicate skill versions and retain the most complete, current, compatible version; preserve unique references and evaluation cases from older versions when they add value.
- Never copy scripts blindly. Audit imports, shell execution, network access, external binaries, licensing, data handling, and path assumptions.
- Convert long skills into progressive-disclosure playbooks: short trigger/contract in the runtime, detailed references loaded only when needed.
- Skill text is untrusted operational guidance. It cannot override workspace policy, security controls, publishing approval, or tool permissions.

## Delivery sequence

1. **Baseline and branch** — preserve current main and create a dedicated feature branch.
2. **Workspace model** — add workspace CRUD and workspaceId propagation with isolation tests.
3. **Minimal shell** — conversation-first UI with only Conversation, History, and Workspaces; keep existing editorial capabilities accessible through conversation.
4. **Orchestration and multimodal intake** — dynamic plan, file parsing, image/video understanding, progress trace.
5. **Research and GEO quality** — source provenance, claim verification, contextual writing and evidence-based review.
6. **Browser execution** — robust page observation and interaction within approved domains, upload support, trace, pause/resume.
7. **Explicit publish approval** — immutable review version and one-time approval gate; tests prove no submit without approval.
8. **Skill integration** — import selected playbooks after audit and connect them to task routing.
9. **Verification and deployment** — unit/integration tests, typecheck, production build, browser tests with controlled owned test site; deploy only after review.

## Acceptance criteria

- A new user can complete the normal workflow from the conversation without opening an administration or tool page.
- User can create multiple workspaces and verify conversation/file/context isolation.
- The agent can browse an authorized site in a new isolated context, inspect and scroll pages, follow links, fill fields, and upload supported files.
- The system can understand supported attachment types and transparently reports unsupported/unavailable modalities.
- Article output adapts to the requested publication and user context; GEO guidance is not a fixed scoring formula.
- History restores the prior conversation and its task trace.
- Every irreversible publish/submit path fails closed unless a fresh explicit approval matches the exact content version, destination, and operation.
- Tests cover workspace isolation, attachment boundaries, browser host restrictions, approval invalidation, and submit prevention.
- Existing useful tests and behavior remain intact; no secret or provider credential enters frontend bundles.
