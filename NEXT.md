# NEXT

## Reality

Verified shipped items:

- Sessions list UI.
- Session detail UI (Transcript + Note editor + Copy/Export).
- Notes persist locally per session (localStorage).
- Date parsing fix for YYYY-MM-DD (local helper) + safe separator escape.
- Next.js upgraded to 16.1.6; pnpm audit clean.
- Async params fix for /sessions/[sessionId] route.

Unclassified (present but not proof of behavior):

- Env skeleton exists.
- Verification text present.

## Next smallest step

1) SSO sign-in (Cognito federation)
   - Add Cognito Hosted UI sign-in.
   - Support Microsoft 365 (Entra ID) and Google Workspace (OIDC/SAML).
   - Add practiceId scoping and admin/clinician roles.

2) Temporary job store + TTL purge + Delete now
   - Create job record with expiresAt (default now+24h).
   - Store audio + transcript + draft in S3 under jobs/{jobId}/.
   - Purge worker deletes expired jobs; "Delete now" API purges immediately.
   - Add admin setting to reduce TTL, including delete immediately after export.

3) Wire the end-to-end happy path
   - Upload audio (start with upload; add in-browser recording next).
   - Transcribe (Transcribe Medical).
   - Draft note (Bedrock) for one note type first (SOAP), then expand.
   - Render editable draft and export:
     - EHR-friendly text
     - PDF (client-side print/export)

## Verification

After each change:

- .\tools\gate.cmd /all
- git status -sb
- git diff --stat