# DECISIONS (Locked)

## 2026-01-30 - Track B direction (AWS cloud processing + ephemeral note factory)

- Product focus: structured note drafting to save clinician time (not an EHR, not a "HIPAA SaaS platform").
- No clinical diagnosis or "analysis" features; the output is a draft note only.
- Human approval required: clinicians review/edit before copy/export.

### Cloud and storage

- Cloud transcription: AWS Transcribe Medical.
- Cloud drafting: Amazon Bedrock.
- Temporary job store contains audio + transcript + draft note together under the same TTL.
- Default TTL: 24 hours.
- Admin setting can reduce TTL (including delete immediately after export).
- "Delete now" is available everywhere and triggers immediate purge.

### Auth and tenancy

- Authentication: SSO only (no local passwords).
- SSO providers: Microsoft 365 / Entra ID and Google Workspace.
- Multi-practice ready by design (all requests scoped to practiceId), but initial rollout targets one practice.

### UI / UX decisions

- Exports:
  - EHR-friendly text (predictable headings/sections)
  - PDF via client-side print/export
- Session history: no (the product is not a record system).
- Notes persist in localStorage keyed by session id (temporary MVP UI behavior).
- Date parsing: parse YYYY-MM-DD as a local date via helper to avoid timezone drift.
- UI separator: use JSX escape for bullet separator.

### Engineering discipline

- Gate discipline: run .\tools\gate.cmd /all before commit.
- Keep docs tight, no overclaims: document implemented vs target clearly.

## D002 â€” Policy reference

- SECURITY.md is the authoritative policy for data handling, retention, and cloud processing.
- DECISIONS.md records governing choices and revisit triggers.

Revisit triggers:
- Adding long-term storage or session history.
- Expanding roles and permissions.
- Changing TTL defaults upward.
- Adding non-AWS processors or changing cloud boundaries.

## 2026-02-09 - AI Pipeline Architecture & Kill Switch

### Real API Integration
- **Transcription**: OpenAI Whisper API (replaced AWS Transcribe Medical from Track B)
- **Note Generation**: Anthropic Claude API (replaced Amazon Bedrock from Track B)
- Pipeline implementation: `src/lib/jobs/pipeline.ts` orchestrates Whisper → Claude → file writes

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
- Switching back to AWS services
- Adding job queue system (BullMQ, etc.)
- Implementing retry logic for failed API calls
