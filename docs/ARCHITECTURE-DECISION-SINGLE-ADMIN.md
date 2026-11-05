# Architecture Decision — Single Admin, Multiple Workspaces

**Date:** 2026-11-05  
**Status:** Accepted  
**Product decision:** Option 1

## Decision

MAAROOF Editorial Agent will operate as a **single-administrator product**. One authenticated administrator manages multiple independent workspaces. A workspace represents a client, brand, publication project, or another editorial scope.

This release does not introduce user registration, team membership, workspace invitations, per-user roles, or multi-tenant account identity.

## Authentication and authorization boundary

- Keep the existing server-side `ADMIN_API_TOKEN` bearer authentication.
- Do not expose the token in client bundles or persist it in browser local storage.
- All workspace-scoped API requests require the administrator authentication gate.
- The requested workspace must exist and be active before workspace-scoped reads or writes proceed.
- Workspace IDs are data-scope selectors, not authentication credentials.
- This is a single-admin access model, not multi-user tenant authorization.

## Workspace isolation

The application must consistently scope these records by `workspaceId`:
- editorial conversations and their messages
- conversation attachments and media
- editorial tasks, drafts, and platform variants
- sources, claims, research evidence, and visibility observations
- browser destinations, sessions, and approval records
- workspace memory, feedback, and execution history as those capabilities are introduced

Ownership checks must compare the workspace ID and the parent record ID. A record ID alone is never sufficient.

## Legacy migration policy

- Legacy conversations with no valid `workspaceId` are assigned to `main-workspace`.
- A legacy conversation attachment with no `workspaceId` is assigned only when exactly one conversation with its `conversationId` exists; it inherits that conversation's workspace.
- Existing non-empty workspace IDs are preserved.
- Orphaned or ambiguous attachments are left untouched and reported for a later explicit repair; the migration must not guess ownership.
- Migration is idempotent and runs during JSON store initialization.
- Migration must never move a record already assigned to a named workspace.

## Workspace lifecycle

- Create, list, read, rename, describe, and archive workspaces.
- Archived workspaces are excluded from the default active list.
- Administrators may explicitly request archived workspaces and restore one.
- The default workspace cannot be archived.
- Archived workspaces cannot be used for normal workspace-scoped operations until restored.

## User experience

The primary experience remains agent-first:
- Conversation
- History
- Workspaces

The selected workspace is a global, visible context for the current conversation and its resources. Switching workspace must reload all workspace-scoped data and clear stale selection state from the previous workspace.

## Non-goals for this decision

- Multiple administrator accounts
- Member invitations and collaboration permissions
- Per-user workspace ACLs
- External publishing without exact, explicit approval
- Supabase or Next.js migration

## Acceptance gates

1. Legacy migration tests cover unscoped records, existing scoped records, orphan attachments, ambiguous IDs, persistence, and idempotence.
2. API tests prove missing/archived workspace IDs are rejected across workspace-prefixed routes and body-scoped operations.
3. Cross-workspace reads and writes are denied for conversations and attachments.
4. Workspace UI supports list/create/rename/archive/restore/switch.
5. The active workspace context is applied consistently to chat, history, library, media, research, and browser sessions.
6. CI passes typecheck, all unit tests, API integration tests, and production build.
7. No production deployment or publishing action occurs without explicit approval.
