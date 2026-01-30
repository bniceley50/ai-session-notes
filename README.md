# AI Session Notes (MVP)

Dead-simple clinical documentation MVP:

session audio → transcript → AI-drafted provider note → provider edits → copy/export

Goal: kill documentation time and make notes fast + consistent on normal laptops.

## Product shape (intentionally minimal)
Two screens:
- Sessions list
- Session detail: Transcript + Note editor + Copy/Export

## Architecture constraints
- Transcription provider is swappable (Deepgram / Whisper / etc.)
- Server-only secrets stay on the server
- Keep the workflow reliable on normal laptops (no fancy setup required)

## Local dev

Prereqs
- Node.js (LTS recommended)
- Git

Install
    npm install

Run
    npm run dev

Quality gate (typecheck + lint)
    .\tools\gate.cmd /all

## Environment variables

This app uses Supabase. You will need these environment variables set (see your .env.local):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only)

Never expose SUPABASE_SERVICE_ROLE_KEY in client code or logs.

## Docs
- SECURITY.md
- docs/TESTING.md

## Notes
- API routes that require server-only secrets should import server-only and run in the Node.js runtime.
- Prefer RLS + least privilege; never trust the client.

## What's working (Current MVP)
- Sessions list page (`/`)
- Session detail page (`/sessions/[sessionId]`) with Transcript + Note editor + Copy/Export
- Notes persist locally per session (localStorage)
- Date parsing uses local Y-M-D helper (no timezone drift)
- Separator uses a safe JSX escape (`{" \u2022 "}`)
- Next.js pinned to patched version (16.1.6); pnpm audit clean

## Troubleshooting
- Dates off by one day: parse `YYYY-MM-DD` as a local date (avoid `new Date("YYYY-MM-DD")`).
- Odd characters in separators: use JSX escapes like `{" \u2022 "}` instead of literal bullets.
