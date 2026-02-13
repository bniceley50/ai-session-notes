# Release Cut Checklist

## Release metadata

| Field | Value |
|---|---|
| Version / tag | `v0.x.x` |
| Date | YYYY-MM-DD |
| Owner | @bniceley50 |
| Scope summary | _one-line description_ |

---

## Pre-release gate

```bash
# Run all from repo root
pnpm tsc --noEmit
pnpm lint
pnpm test
pnpm exec playwright test
```

- [ ] Branch is up to date with `main`
- [ ] `pnpm tsc --noEmit` — clean
- [ ] `pnpm lint` — 0 errors
- [ ] `pnpm test` — all unit tests passing
- [ ] `pnpm exec playwright test` — all e2e specs passing
- [ ] CI green on the target merge commit

## Functional smoke test (core loop)

Run manually against the deploy target (staging or production):

- [ ] Dev login works (or real auth if production)
- [ ] Upload audio file
- [ ] Transcription completes — transcript visible
- [ ] Generate SOAP note — draft appears
- [ ] Transfer to Notes — NoteEditor populated
- [ ] Export works (copy / download)
- [ ] Cancel mid-run — UI resets, no lingering state
- [ ] Delete completed job — artifacts cleaned up, UI resets

## Runtime dependencies

- [ ] **FFmpeg** on PATH — required for chunked transcription (audio >24MB)
  ```bash
  ffmpeg -version   # should print version info
  ```

## Config / security checks

- [ ] Required env vars present in deploy environment
- [ ] No secrets in tracked files (`git diff --stat` to verify)
- [ ] `AUTH_COOKIE_SECRET` set in deploy env
- [ ] API mode flags correct (`AI_ENABLE_REAL_APIS` / `AI_ENABLE_STUB_APIS`)
- [ ] `JOBS_RUNNER_TOKEN` set in deploy env

```bash
# Quick sanity — no untracked secrets
git status -sb
git diff --stat
```

## Scheduled cleanup (artifact TTL enforcement)

Job artifacts are auto-deleted after 24 hours. The cleanup logic is fully
implemented in `src/lib/jobs/purge.ts` (`purgeExpiredJobArtifacts()`).

**Vercel cron is pre-configured** in `vercel.json` — every 15 minutes,
Vercel sends a GET request to `/api/jobs/runner` with the `CRON_SECRET`
as a Bearer token. The endpoint processes queued jobs and purges expired
artifacts + stale session locks in a single call.

### Vercel deploy requirements

1. Set `CRON_SECRET` in Vercel Dashboard → Settings → Environment Variables
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Verify cron is active: Vercel Dashboard → Project → Cron Jobs tab
3. The runner endpoint is public in middleware (bypasses session auth)
   but requires `CRON_SECRET` or `JOBS_RUNNER_TOKEN` — unauthenticated
   requests return 401

### Non-Vercel hosts (Option B)

Use cron, systemd timer, GitHub Actions schedule, or any HTTP scheduler.
Both GET and POST methods are supported:

```bash
# Every 15 minutes — POST with JOBS_RUNNER_TOKEN
*/15 * * * * curl -s -X POST https://<deploy-url>/api/jobs/runner \
  -H "Authorization: Bearer $JOBS_RUNNER_TOKEN"

# Or GET (same auth)
*/15 * * * * curl -s https://<deploy-url>/api/jobs/runner \
  -H "Authorization: Bearer $JOBS_RUNNER_TOKEN"
```

### Checklist

- [ ] `CRON_SECRET` set in Vercel environment (or `JOBS_RUNNER_TOKEN` for non-Vercel)
- [ ] Cron active in Vercel Dashboard (or external scheduler configured)
- [ ] Verify cleanup runs: check server logs for purge results after first trigger
- [ ] Verify stale session locks are cleaned (locks older than 5 minutes)

## Deployment steps

- [ ] Squash merge PR to `main`
- [ ] Verify CI passes on merged commit
- [ ] Create Git tag: `git tag v0.x.x && git push origin v0.x.x`
- [ ] Create GitHub release with scope summary and notable changes
- [ ] Post-deploy health check:
  ```bash
  curl -s https://<deploy-url>/api/health | jq .
  # Expected: {"status":"ok","timestamp":"..."}
  ```
- [ ] App loads, login works, no console errors

## Rollback plan

- [ ] Last known good commit identified: `_______________`
- [ ] Rollback method: redeploy previous commit or revert merge
- [ ] Owner assigned for rollback execution: @bniceley50

If rollback is needed:

```bash
# Option A: Revert the merge commit
git revert -m 1 <merge-sha>
git push origin main

# Option B: Redeploy last known good
# (use hosting provider's deploy-to-commit feature)
```

## Post-release validation

- [ ] Monitor CI and error reports for 30–60 minutes
- [ ] Verify core loop works in production (upload → transcribe → note → export)
- [ ] Create follow-up issues for any known non-blockers discovered during release

## Auth notes

All data API routes require a valid session cookie (enforced by middleware).
The only unauthenticated API endpoint is `GET /api/health` (liveness probe).
The health response contract is intentionally minimal (`status`, `timestamp`)
— do not add fields without updating tests and this checklist.
