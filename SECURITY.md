# Security

## Scope

AI Session Notes MVP: record a session (or upload audio) -> transcribe -> select note type (SOAP/DAP/BIRP/GIRP/Intake/Discharge) -> draft note -> human edits/approves -> copy/export. The system is NOT the system of record (the EHR is).

## Non-goals

- No clinical diagnosis or "analysis" features.
- No long-term storage / session history in the product.
- No silent cloud. Any cloud processing is explicit and part of the workflow.

## System boundary

- Web UI: Next.js app used by clinicians.
- Backend API + workers: runs on AWS and performs temporary processing.
- Cloud processors:
  - AWS Transcribe Medical for transcription.
  - Amazon Bedrock for note drafting.

## Data handling

Treat audio, transcripts, and draft notes as sensitive (PHI in real-world use).

### Storage model

All processing artifacts live in a temporary job store and are deleted automatically.

- Job artifacts include:
  - audio file
  - transcript
  - draft note (text and/or structured JSON)
- Default TTL: 24 hours
- Admin can reduce TTL (including delete immediately after export)
- "Delete now" is always available in the UI and triggers immediate purge

### Deletion enforcement

Target implementation (must be true before claiming enforcement in production):

- Purge worker deletes expired jobs based on an expiresAt timestamp.
- S3 objects are deleted by prefix for the job (audio/transcript/draft).
- DynamoDB job records expire via TTL.
- S3 lifecycle deletion is configured as a backstop for missed objects.

## Authentication and authorization

- SSO only.
- Authentication is handled via Amazon Cognito federation (OIDC or SAML) to:
  - Microsoft 365 / Entra ID
  - Google Workspace
- Multi-practice ready: every request is scoped to a practiceId and userId.

Authorization rules (MVP):

- Users can only access jobs belonging to their practiceId.
- Only admins can change practice-level settings (TTL policy, allowed note types).
- Clinicians can create jobs, view results for their jobs, export, and purge.

## Secrets and credentials

- No long-lived secrets in the client.
- AWS access uses IAM roles for compute (least privilege).
- If any server-only keys exist (e.g., legacy integrations), they must never be exposed to the client or logs.

## Logging hygiene

- Do not log audio, transcript text, or draft note content.
- Logs should contain request ids, job ids, status transitions, and coarse timing only.
- Any error reporting must redact payloads and headers.

## Transport and encryption

- TLS for all client <-> backend traffic.
- Encrypt temporary storage at rest (S3 + KMS).
- Restrict S3 access to backend roles only.

## Dependency hygiene

- Package manager: pnpm
- Security checks:
  - pnpm audit
  - Dependabot (recommended)

As of 2026-01-30:
- Next.js: 16.1.6
- pnpm audit: clean

## Reporting

Security issues: open a private issue or contact the maintainer.

## Revisit triggers

Update this policy when any of the following changes:

- Adding session history / long-term storage.
- Expanding roles beyond admin/clinician.
- Changing TTL defaults upward.
- Moving any PHI processing to non-AWS vendors.
- Enabling public SaaS / internet exposure beyond a single practice rollout.