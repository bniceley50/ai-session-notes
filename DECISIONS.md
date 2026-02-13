# DECISIONS (Locked)

<!-- Superseded -->
## 2026-01-30 - Track B direction (SUPERSEDED by 2026-02-09 entry below)

> **This section is historical.** The cloud services and architecture described here were replaced
> on 2026-02-09. See the next section for current decisions.

- Product focus: structured note drafting to save clinician time (not an EHR, not a "HIPAA SaaS platform").
- No clinical diagnosis or "analysis" features; the output is a draft note only.
- Human approval required: clinicians review/edit before copy/export.

### Cloud and storage (superseded)

- Cloud transcription: AWS Transcribe Medical. **(Replaced by OpenAI Whisper API)**
- Cloud drafting: Amazon Bedrock. **(Replaced by Anthropic Claude API)**
- Temporary job store contains audio + transcript + draft note together under the same TTL.
- Default TTL: 24 hours.
- Admin setting can reduce TTL (including delete immediately after export).
- "Delete now" is available everywhere and triggers immediate purge.

### Auth and tenancy (superseded)

- Authentication: SSO only (no local passwords). **(Replaced by cookie-based session auth)**
- SSO providers: Microsoft 365 / Entra ID and Google Workspace. **(Not yet implemented)**
- Multi-practice ready by design (all requests scoped to practiceId), but initial rollout targets one practice.

### UI / UX decisions (partially current)

- Exports:
  - EHR-friendly text (predictable headings/sections)
  - PDF via client-side print/export
- Session history: no (the product is not a record system).
- Notes persist in Supabase `notes` table (keyed by session id + note type).
- Date parsing: parse YYYY-MM-DD as a local date via helper to avoid timezone drift.
- UI separator: use JSX escape for bullet separator.

### Engineering discipline

- Gate discipline: `pnpm tsc --noEmit && pnpm lint && pnpm test` before commit.
- Keep docs tight, no overclaims: document implemented vs target clearly.

## D002 - Policy reference

- SECURITY.md is the authoritative policy for data handling, retention, and cloud processing.
- DECISIONS.md records governing choices and revisit triggers.

Revisit triggers:
- Adding long-term storage or session history.
- Expanding roles and permissions.
- Changing TTL defaults upward.
- Adding new AI/cloud processors or changing cloud boundaries.

## 2026-02-09 - AI Pipeline Architecture & Kill Switch

### Real API Integration
- **Transcription**: OpenAI Whisper API (replaced Track B cloud transcription service)
- **Note Generation**: Anthropic Claude API (replaced Track B cloud drafting service)
- Pipeline implementation: `src/lib/jobs/pipeline.ts` orchestrates Whisper -> Claude -> file writes

### Safety & Cost Control
- **Kill switch**: `AI_ENABLE_REAL_APIS=1` required to enable real API calls
- **Explicit stub mode**: `AI_ENABLE_STUB_APIS=1` for UI testing without API costs
- **Default behavior**: Pipeline fails fast with clear error if neither flag set (prevents accidental spending)

### Legacy Route Cleanup
- **Removed**: `src/app/api/jobs/[jobId]/transcribe/route.ts` (stub writer route, replaced by pipeline)
- **History**: Git contains full history of removed stub routes
- **Active routes**: GET routes for transcript/draft reading remain (serve files written by pipeline)

### Durable Job Processing
- **Development**: `setTimeout()` fire-and-forget in `/api/jobs/create`
- **Production**: `/api/jobs/runner` endpoint processes queued jobs
- **Runner design**: Hybrid approach supports cron, scheduled functions, or worker process
- **Implementation**: Shared logic in `src/lib/jobs/runner.ts` callable from multiple contexts

Revisit triggers:
- Switching AI providers
- Adding job queue system (BullMQ, etc.)
- Implementing retry logic for failed API calls
