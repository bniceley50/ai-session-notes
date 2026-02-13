# AI Session Notes (MVP)

[![E2E – Playwright](https://github.com/bniceley50/ai-session-notes/actions/workflows/e2e-playwright.yml/badge.svg)](https://github.com/bniceley50/ai-session-notes/actions/workflows/e2e-playwright.yml)

Dead-simple legal intake documentation MVP:

**session audio → transcript → AI-drafted attorney matter note → attorney edits → copy/export**

Goal: reduce documentation time and make matter notes fast + consistent on normal laptops.

## Quick links

| Resource | Path |
|---|---|
| E2E test | `tests/e2e/core-loop.spec.ts` |
| CI workflow | `.github/workflows/e2e-playwright.yml` |
| CI troubleshooting | `docs/CI-TROUBLESHOOTING.md` |
| Testing guide | `docs/TESTING.md` |
| Repo hygiene automation | `docs/REPO_HYGIENE.md` |
| Security notes | `SECURITY.md` |
| Penetration testing | `docs/PENTEST_PROMPT.md` |

## Product shape (intentionally minimal)

Two screens:
- **Sessions list** — pick or create a session
- **Session workspace** — Audio Input + Transcript + AI Analysis + Structured Notes

## Local dev

**Prereqs:** Node.js >= 22, pnpm

```bash
pnpm install              # install deps
cp .env.example .env.local # configure env vars (see below)
pnpm dev                  # start dev server at http://localhost:3000
```

**Quality gate** (run before every PR):
```bash
pnpm tsc --noEmit && pnpm eslint src/
```

**E2E test** (stub mode — no API spend):
```bash
pnpm exec playwright install --with-deps chromium   # first time only
pnpm exec playwright test
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in values. Key groups:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only — never expose in client code |
| `AUTH_COOKIE_SECRET` | Yes | >= 32 chars for session JWT signing |
| `OPENAI_API_KEY` | For real mode | Whisper transcription |
| `ANTHROPIC_API_KEY` | For real mode | Claude note generation |
| `AI_ENABLE_REAL_APIS` | No | Set `1` to enable real API calls |
| `AI_ENABLE_STUB_APIS` | No | Set `1` for stub mode (no API spend) |
| `ALLOW_DEV_LOGIN` | No | Set `1` to bypass Cognito in dev |

## Architecture constraints

- Transcription provider is swappable (Whisper / Deepgram / etc.)
- Server-only secrets stay on the server
- Disposable data model — 24-hour auto-delete, not a case-management system
- API routes that require server-only secrets import `server-only` and run in the Node.js runtime

## What's working (Current MVP)

- Sessions list page (`/`)
- Session workspace (`/sessions/[sessionId]`) — Audio Input, Transcript, AI Analysis, Structured Notes
- Full pipeline: upload → transcribe (Whisper) → generate matter note (Claude) → export
- Cancel/delete job with filesystem cleanup
- E2E test covering the core loop (stub mode)
- CI via GitHub Actions (Playwright on every PR)

## Troubleshooting

- Dates off by one day: parse `YYYY-MM-DD` as a local date (avoid `new Date("YYYY-MM-DD")`)
- CI failures: see `docs/CI-TROUBLESHOOTING.md`

## Repo hygiene automation

- PR gate: `.github/workflows/repo-hygiene-pr.yml`
- Nightly deep audit: `.github/workflows/repo-hygiene-nightly.yml`
- Weekly autofix PR: `.github/workflows/repo-hygiene-weekly-autofix.yml`
- OpenClaw summary command: `pnpm hygiene:openclaw:summary`
