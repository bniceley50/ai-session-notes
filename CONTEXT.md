# CONTEXT (Always Current)
Project: AI Session Notes MVP
Repo Path: N:\asn\ai-session-notes
Stack: Next.js (App Router) + Supabase + Vercel + Deepgram + LLM (later)

# # Product foundation (MVP)

- What we’re building: a dead-simple “session → transcript → clinical note” app with audio record/upload, transcription, AI draft, and clinician edits.
- Why we’re building it: reduce documentation burden; turn messy audio into usable notes fast with minimal clicks.
- Who it’s for: primary clinicians/therapists/counselors/case managers; secondary admin/compliance reviewers later.
- How we’re building it (reliable + maintainable): keep layers separate (capture, processing pipeline, UI/storage), adapter boundary for transcription so providers can swap (Deepgram/Whisper/etc), and keep the workflow fast on typical laptops/desktops.
- Templates: choose per session (SOAP/DAP/BIRP/custom via dropdown).
- Transcription provider: flexible; default can be Deepgram but not locked.
- Primary export: copy to clipboard for EHR paste (V1 success metric).
- UI MVP: two screens — Sessions list, and Session detail with Transcript + Note editor + Copy action.


# # Current State (as of 2026-01-15 19:06)
- Next.js app scaffolded via pnpm
- pnpm installed globally and working
- Supabase CLI is being run via: npx -y supabase@latest
- NOTE: supabase init did not create a supabase/ folder yet (it printed help instead)

# # What We’re Building (MVP)
- Create sessions (label required)
- Record/upload audio in-browser
- Upload to Supabase Storage (deterministic path)
- Transcribe (Deepgram)
- Generate SOAP/DAP notes (LLM)
- Edit transcript/note + copy/export
- Retention deletes audio after deadline + hard cap

# # Guardrails
- No PHI in logs
- Strict RLS (org_id everywhere)
- One action per turn + gate after
