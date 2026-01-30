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
