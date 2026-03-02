# Durability Phase 1: Crash-safe + Idempotent Local Pipeline

## Status

- **Phase 1**: shipped (67a6dce, 1b7f9fb, e605314)
  - Atomic writes via temp-file + rename (`writeFileAtomic`)
  - Job state file (`state.json`) written at every stage boundary
  - Idempotent stage skip: existing non-empty outputs are not rewritten on re-run
- **Phase 2**: not started (retry semantics + error classification)
- **Phase 3**: not started (concurrency under scheduler overlap)

**Scope**: single-node, local filesystem. Not distributed, not multi-worker, not exactly-once across machines.

## Goal

Make job processing boring and reliable: safe to retry, safe to crash, safe under concurrency, and safe under partial artifacts.

This doc defines the minimal durability work needed to move from "works in dev" to "survives production reality".

## Current State (Observed)

- Jobs run locally via pipeline functions (no HTTP self-calls).
- Scheduled runner exists at `/api/jobs/runner` and is invoked via Vercel cron every 15 minutes.
- Session-level concurrency guard exists (`session.lock` via `sessionLock.ts`).
- `runner.lock` is always removed in `finally` (as of 08b7313).
- Artifact exports are hardened (safe Content-Disposition, no-store, nosniff, CSP sandbox).
- TTL-based purge runs automatically via the same runner endpoint.

## Non-Goals (for now)

- Distributed queue / multi-worker orchestration.
- Multi-region durability.
- Exactly-once guarantees across multiple machines.

## Invariants We Must Maintain

1. **Idempotency**: Re-running the same job must not corrupt artifacts or produce conflicting output.
2. **Atomicity**: Outputs must be written atomically (no partially-written "final" files).
3. **Crash Safety**: A crash mid-pipeline must not permanently block future runs (no orphan locks).
4. **Concurrency Safety**: Two pipelines must not produce overlapping artifacts for the same session.
5. **Bounded Storage**: Artifacts and locks must be purged on schedule.

## Failure Modes to Handle

| Failure | Current behavior | Target behavior |
|---|---|---|
| Process crash during stage (transcribe/draft/export) | Partial files may remain; runner.lock cleaned in finally | Temp files cleaned; job marked failed; next run can retry |
| Disk full / permission errors mid-write | Unhandled; partial output possible | Write to temp first; rename atomically; fail loudly |
| Partial artifact present (transcript exists, draft does not) | Next run starts from scratch | Idempotent stages: skip completed stages, rerun incomplete |
| Lock orphaned due to unexpected exit | runner.lock cleaned in finally; session.lock has stale-lock purge | Same, but verify all exit paths are covered |
| Duplicate run triggered by scheduler retry / manual retrigger | Session lock prevents concurrent runs | Same, plus idempotent stage skip |
| Job deleted during execution | Undefined | Check deletion flag between stages; abort cleanly |

## Phased Plan (Minimal)

### Phase 1 — Crash-safe artifacts + lock hygiene + idempotent skip  ✅ DONE

Shipped in 3 patches. No new abstractions.

- **Patch 1** (67a6dce): `writeFileAtomic()` helper — write to `.tmp-<random>`, rename atomically.
  All pipeline `writeTextFile` calls routed through it (transcript, draft, export).
  6 unit tests in `writeFileAtomic.test.ts`.
- **Patch 2** (1b7f9fb): `state.json` written at every stage boundary via `writeFileAtomic`.
  Records `status` (running/complete/failed), `stage` (init/transcribe/draft/export),
  `updatedAt`, and `error` (name + message on failure). New module: `jobState.ts`.
- **Patch 3** (e605314): Idempotent stage skip. Each stage checks if its final output
  exists and is non-empty before running. Skip is logged. State.json still transitions
  through all stages on skip so it reflects what the pipeline traversed.
  Transcript skip requires BOTH job + session transcript to exist (consistency guard).
- **Acceptance** (all verified by tests):
  - No `.tmp-` files remain after successful pipeline (pipeline.test.ts).
  - No orphan `runner.lock` after any exit path (success/failure/deletion).
  - Re-run on same job: output mtimes unchanged, state.json = complete/export,
    log contains "skipped" messages (pipeline.test.ts idempotent re-run test).
  - Failed pipeline: state.json shows failed with error details.

### Phase 2 — Retry semantics + error classification

Idempotent stage skip was pulled forward into Phase 1. What remains:

- Classify errors as transient vs permanent:
  - Transient (network timeout, 5xx from upstream API): eligible for automatic retry with backoff.
  - Permanent (invalid audio, 4xx from API, malformed input): mark failed, do not retry.
- Add manual retry endpoint that resets status to queued + clears failed error.
  Idempotent skip (Phase 1) makes this safe — completed stages won't re-run.
- **Acceptance checks**:
  - Forced transient failure → job retried successfully on next runner pass.
  - Forced permanent failure → job marked failed with useful error; can be retried manually.
  - Manual retry on failed job → pipeline resumes from failed stage (skips completed).

### Phase 3 — Durability under concurrency and schedule overlap

- Ensure scheduler overlap cannot run two jobs for one session concurrently:
  - `sessionLock` is authoritative.
  - Queued job selection respects active job check.
- Handle "deleted during execution" gracefully:
  - Check job status between stages; abort if deleted.
  - Clean up any partial artifacts on abort.
- **Acceptance checks**:
  - Run two runner invocations concurrently → only one processes a given session.
  - Delete a job mid-pipeline → pipeline aborts cleanly, no orphan artifacts.

## Definition of Done

- We can kill the dev server mid-job and recovery behaves predictably.
- No orphan lock files remain after success/failure/deletion.
- Jobs are safe to re-run without manual cleanup.
- Purge runs on schedule and reports counts.
- `pnpm tsc --noEmit && pnpm lint && pnpm test` passes after each phase.
