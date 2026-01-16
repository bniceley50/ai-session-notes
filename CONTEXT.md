# CONTEXT (Always Current)
Project: AI Session Notes MVP
Repo Path: N:\asn\ai-session-notes
Stack: Next.js (App Router) + Supabase + Vercel + Deepgram + LLM (later)

## Current State (as of 2026-01-15 19:06)
- Next.js app scaffolded via pnpm
- pnpm installed globally and working
- Supabase CLI is being run via: npx -y supabase@latest
- NOTE: supabase init did not create a supabase/ folder yet (it printed help instead)

## What We’re Building (MVP)
- Create sessions (label required)
- Record/upload audio in-browser
- Upload to Supabase Storage (deterministic path)
- Transcribe (Deepgram)
- Generate SOAP/DAP notes (LLM)
- Edit transcript/note + copy/export
- Retention deletes audio after deadline + hard cap

## Guardrails
- No PHI in logs
- Strict RLS (org_id everywhere)
- One action per turn + gate after
