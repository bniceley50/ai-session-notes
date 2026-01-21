# NEXT (Only the next 1-3 actions)

1) Initialize Supabase local folder in repo: `npx -y supabase@latest init`.
   Verify: `Test-Path .\supabase\config.toml` returns True.

2) Add Supabase client + env skeleton (no secrets committed).
   Verify: `git status -sb` shows only expected changes and app still boots (`pnpm dev`).
