# NEXT

## Reality

Verified shipped items (as of 2026-02-12):

- Session detail UI (Transcript + Note editor + Copy/Export).
- Notes persist in Supabase `notes` table (keyed by session id + note type).
- Audio upload (WebM) with server-side validation.
- Job pipeline: upload -> Whisper transcription -> Claude note drafting -> file writes.
- Chunked transcription for audio >24MB (FFmpeg splitting + overlap stitching).
- AI kill switch (`AI_ENABLE_REAL_APIS`) and explicit stub mode (`AI_ENABLE_STUB_APIS`).
- Job runner (`POST /api/jobs/runner`) with token auth and purge logic.
- Cookie-based session auth with middleware enforcement on all data routes.
- Health endpoint (`GET /api/health`) for liveness probes.
- Config validation at startup (`instrumentation.ts`).
- Export: copy-to-clipboard and .docx download.
- 19 test files covering auth guards, routes, jobs, config, health, export, pipeline.

## Completed items

1) ~~**Scheduled cleanup wiring**~~ ✓
   - `/api/jobs/runner` handles GET (Vercel cron) and POST (external scheduler) with `CRON_SECRET` / `JOBS_RUNNER_TOKEN` auth.
   - `vercel.json` cron configured: `*/15 * * * *`.
   - Commits: 1692c4b, 4d04205, 3719cfd.

2) ~~**Concurrent job guard**~~ ✓
   - Session-level lock (`session.lock`) prevents multiple active jobs per session.
   - `findActiveJobForSession()` blocks job creation when session already has a queued/running job.
   - Commit: 0c3f2d3.

3) ~~**Admin client fallback hardening**~~ ✓
   - Production-only `console.warn` (once per process) in `resolveClient()` when falling back to admin Supabase client.
   - Caller + sessionId included in warning metadata; 6 tests in `notes.test.ts`.
   - Commit: 21ce0ca.

4) ~~**Auth route hardening**~~ ✓
   - State-changing auth endpoints require POST + CSRF (Origin/Referer allowlist).
   - Middleware allowlist tightened (no prefix-based `/api/auth/*` bypass).
   - Commit: 14988e1.

5) ~~**Export/download header hardening**~~ ✓
   - All artifact download routes set safe Content-Disposition (sanitized filename), X-Content-Type-Options: nosniff, Cache-Control: no-store, Content-Security-Policy: sandbox.
   - Commit: 64eb7ef.

6) ~~**Lock file cleanup**~~ ✓
   - `runner.lock` now removed in `finally` block of `runJobPipeline()` (success, failure, early exit).
   - `session.lock` already cleaned by `releaseSessionLock()` + stale-lock purge in `purge.ts`.
   - Commit: 08b7313.

## Next workstream: Durability architecture

The remaining real work is making job execution boring and reliable. See `docs/DURABILITY.md` for the full plan.

Summary of phases:
- **Phase 1** — Crash-safe artifacts + lock hygiene (atomic temp-file writes, job state file, crash recovery)
- **Phase 2** — Retry semantics + idempotent stage execution (skip completed stages, transient vs permanent errors)
- **Phase 3** — Durability under concurrency and schedule overlap (authoritative session lock, safe scheduler overlap)

## Verification

After each change:

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test
```
