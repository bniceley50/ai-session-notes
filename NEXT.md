# NEXT (Only the next 1-3 actions)

1) Add Supabase server/client boundary helpers:
   - Mark `src/lib/supabase/client.ts` as client-only (prevents accidental server imports).
   - Add `src/lib/supabase/admin.ts` as server-only (service role client for API routes).
   - Refactor `src/app/api/orgs/bootstrap/route.ts` to use the admin helper (no behavior change).
   Verify: `pnpm dev` starts; `tools\gate.cmd` passes.

Completed:
- Supabase local folder exists (`supabase/config.toml` is present).
- Env skeleton exists (`.env.example` has required keys; `.env.local` is gitignored).
- Browser client module exists (`src/lib/supabase/client.ts`).
