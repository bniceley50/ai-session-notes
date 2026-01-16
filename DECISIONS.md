# DECISIONS (Locked)
- Repo location: N:\asn\ai-session-notes
- Package manager: pnpm
- Supabase CLI: run via npx (NOT npm -g)
- Deterministic storage path: {org_id}/{session_id}/audio.{ext}
- Audio retention: org setting + hard cap (72h)
- No multi-org testing right now (single org + role separation only)
