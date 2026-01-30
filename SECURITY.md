# Security

# # Scope
AI Session Notes MVP: session audio → transcript → AI-drafted provider note → provider edits → copy/export.

# # Principles
- Server-only secrets stay on the server
- Least privilege
- Defense in depth (authn + authz + validation + logging hygiene)

# # Secrets & Environment
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Never expose service role key in any client code or logs.
- Any route handler using service role must import `server-only` and run in Node.js runtime.

# # Authentication & Authorization
- API requests require a Bearer token where applicable.
- Users must be authorized for org/session access (enforced via server logic and/or RLS).
- Validate inputs on every boundary (request body, params).

# # Data Handling
- Treat transcripts/notes/audio as sensitive.
- Avoid logging transcript/note content.
- If storing audio, document where it lives and how access is restricted.

# # Supabase
- Prefer RLS for user/org scoped tables.
- If any access uses the service role key, enforce explicit authorization checks server-side (never “trust the client”).

# # Dependencies
- Keep dependencies updated.
- Run `npm audit` periodically.
- Enable Dependabot (recommended).

# # Reporting
- Security issues: open a private issue / contact maintainer.
