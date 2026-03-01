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

## Next smallest steps

1) **Scheduled cleanup wiring**
   - Wire `POST /api/jobs/runner` to a scheduler (Vercel cron or external) so TTL-based purge runs automatically.
   - Currently purge only runs on manual trigger or runner invocation.

2) **Concurrent job guard**
   - Prevent multiple active jobs per session (race-safe with session-level lock).
   - Block job creation when session already has a `queued` or `running` job.

3) **Admin client fallback hardening**
   - Add production-only warning when notes service falls back to admin Supabase client (bypasses RLS).
   - Audit all callers to ensure user-scoped client is passed.

4) **Export polish**
   - Verify .docx export formatting matches EHR-friendly structure.
   - Add .txt plain-text export option.

5) ~~**Lock file cleanup**~~ ✓
   - `runner.lock` now removed in `finally` block of `runJobPipeline()` (success, failure, early exit).
   - `session.lock` already cleaned by `releaseSessionLock()` + stale-lock purge in `purge.ts`.

## Verification

After each change:

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test
```
