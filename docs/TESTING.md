# Testing

# # Goals
- Prevent regressions in session → transcript → note workflow
- Keep API behavior stable (auth, validation, error codes)
- Enable safe refactors

# # What we test (now)
# # # Unit
- token parsing (Bearer header)
- input validation (org name, session ids)
- helper functions (formatting, mapping)

# # # API routes
- 500 "Server misconfigured" when env vars missing
- 401 when missing/invalid bearer token
- 200 on happy path (mocked Supabase)

# # How to run
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm test`

# # Conventions
- Put unit tests next to code: `*.test.ts`
- Keep route tests focused on status codes + response shape
- Do not hit real Supabase in unit tests
