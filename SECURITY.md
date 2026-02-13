# Security

## Scope

AI Session Notes MVP: upload audio -> transcribe -> select note type (SOAP/DAP/BIRP/GIRP/Intake/Discharge) -> draft note -> human edits/approves -> copy/export. The system is NOT the system of record (the EHR is).

## Non-goals

- No clinical diagnosis or "analysis" features.
- No long-term storage / session history in the product.
- No silent cloud. Any cloud processing is explicit and part of the workflow.

## System boundary

- Web UI: Next.js app used by clinicians.
- Backend API: Next.js API routes (Node.js runtime).
- Cloud processors:
  - OpenAI Whisper API for transcription.
  - Anthropic Claude API for note drafting.
- Database: Supabase (PostgreSQL with Row Level Security).

## Data handling

Treat audio, transcripts, and draft notes as sensitive (PHI in real-world use).

### Storage model

All processing artifacts live in a temporary job store and are deleted automatically.

- Job artifacts include:
  - audio file (filesystem)
  - transcript (filesystem)
  - draft note (filesystem + Supabase `notes` table)
- Default TTL: 24 hours
- "Delete now" is always available in the UI and triggers immediate purge

### Deletion enforcement

Current implementation:

- Purge logic in `src/lib/jobs/purge.ts` deletes expired job directories based on `createdAt` + TTL.
- Filesystem artifacts are deleted by job directory (audio/transcript/draft/status/lock files).
- Empty session directories are cleaned up after all jobs are deleted.
- Purge is triggered by `POST /api/jobs/runner` (token-authenticated, designed for scheduled invocation) and `POST /api/jobs/purge` (admin-authenticated, manual trigger).
- In-memory job store (`src/lib/jobs/store.ts`) has opportunistic cleanup on access and explicit `purgeExpired()`.
- **Not yet automated**: No scheduler is wired up to call the runner endpoint on a recurring basis. This is a known gap — artifacts currently accumulate until manual cleanup or runner invocation.

## Authentication and authorization

- Cookie-based session auth (signed JWT in httpOnly cookie).
- Session tokens signed with `AUTH_COOKIE_SECRET` (32+ byte random secret).
- Multi-practice ready: every request is scoped to a `practiceId` and `userId`.
- Middleware (`middleware.ts` at project root) enforces authentication on all routes except:
  - `GET /api/health` (liveness probe, exact match)
  - `/api/auth/*` (auth flow endpoints, prefix match)
  - `/_next/*` (Next.js static assets, prefix match)
  - Static file extensions (`.js`, `.css`, `.png`, `.ico`, etc.)
  - `/login`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml` (exact match)

Authorization rules (MVP):

- Users can only access jobs belonging to their `practiceId` (Supabase RLS + `is_org_member()` function).
- Note CRUD uses user-scoped Supabase client when available (RLS active); falls back to admin client for bootstrap operations.
- `POST /api/jobs/runner` requires `JOBS_RUNNER_TOKEN` (prevents unauthorized API spending).

## Secrets and credentials

- No long-lived secrets in the client.
- Server-only API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JOBS_RUNNER_TOKEN`.
- `AUTH_COOKIE_SECRET` used for signing session cookies.
- All secrets loaded via environment variables, validated at startup by `src/lib/config.ts`.

## Logging hygiene

- Do not log audio, transcript text, or draft note content.
- Logs should contain request ids, job ids, status transitions, and coarse timing only.
- Any error reporting must redact payloads and headers.

## Transport and encryption

- TLS for all client <-> backend traffic (HTTPS enforced by hosting).
- Supabase connections use TLS.
- Filesystem artifacts are stored on the application server (not encrypted at rest by default — encryption depends on hosting provider's disk encryption).

## Dependency hygiene

- Package manager: pnpm
- Security checks:
  - pnpm audit
  - Dependabot (recommended)

As of 2026-02-12:
- Next.js: 16.1.6
- pnpm audit: clean

## Reporting

Security issues: open a private issue or contact the maintainer.

## Revisit triggers

Update this policy when any of the following changes:

- Adding session history / long-term storage.
- Expanding roles beyond admin/clinician.
- Changing TTL defaults upward.
- Moving to new AI/cloud processors.
- Enabling public SaaS / internet exposure beyond a single practice rollout.
- Adding rich text rendering of AI-generated content (XSS surface expansion).
