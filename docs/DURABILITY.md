# Durability Architecture Plan

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

### Phase 1 — Crash-safe artifacts + lock hygiene

Smallest high-value change. No new abstractions.

- Ensure every pipeline stage writes to a temp file then renames atomically to final name.
- Verify locks are always released in finally blocks (runner.lock, session.lock) — already done, but audit for edge cases.
- Add a single "job state" file (`state.json`) updated after each stage:
  - `status`: queued | running | complete | failed | deleted
  - `stage`: transcribe | draft | export
  - `updatedAt`: ISO timestamp
  - `error`: error summary (if failed)
- **Acceptance checks**:
  - Simulate crash mid-stage (kill process) → next runner pass can re-run safely.
  - No `*.tmp` files remain after normal success.
  - No orphan `runner.lock` persists after any exit path.

### Phase 2 — Retry semantics + idempotent stage execution

- Define when to retry automatically:
  - Transient errors (network timeout, 5xx from upstream API): retry up to N times with backoff.
  - Permanent errors (invalid audio, 4xx from API, malformed input): mark failed, do not retry.
- Make stage functions idempotent:
  - If final output exists and matches expected shape → skip stage.
  - If final output missing but temp exists → clean temp and rerun.
- **Acceptance checks**:
  - Re-run runner twice on same job → artifacts unchanged, no duplication.
  - Forced transient failure → job retried successfully on next runner pass.
  - Forced permanent failure → job marked failed with useful error; can be retried manually.

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
