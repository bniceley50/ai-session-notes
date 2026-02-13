/**
 * Session-level lock for concurrent job guard.
 *
 * Prevents TOCTOU race: two simultaneous job-create requests both seeing
 * "no active job" and both proceeding. Uses an atomic lock file (wx flag)
 * so only one request wins; the loser gets 409 immediately.
 *
 * Design decisions:
 * - Lock contention returns false immediately (no blocking/retry)
 * - Lock is released in `finally` (no stale lock on error)
 * - Scans filesystem index (not in-memory Map) for source of truth
 */

import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import { getSessionDir, readJobStatusById } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/status";

const JOB_INDEX_DIR = path.resolve(ARTIFACTS_ROOT, "_index", "jobs");

const ACTIVE_STATUSES: ReadonlySet<JobStatus> = new Set(["queued", "running"]);

function getSessionLockPath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), "session.lock");
}

/**
 * Acquire session lock. Returns true if acquired, false if contention.
 * Caller MUST call releaseSessionLock in a finally block.
 */
export async function acquireSessionLock(sessionId: string): Promise<boolean> {
  const lockPath = getSessionLockPath(sessionId);
  try {
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(
      lockPath,
      JSON.stringify({ lockedAt: new Date().toISOString(), pid: process.pid }),
      { flag: "wx" },
    );
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

/**
 * Release session lock (best-effort). Safe to call even if lock wasn't acquired.
 */
export async function releaseSessionLock(sessionId: string): Promise<void> {
  try {
    await fs.rm(getSessionLockPath(sessionId), { force: true });
  } catch {
    // best-effort — lock file may already be gone
  }
}

/**
 * Check if the session has any active (queued or running) jobs.
 * Reads from filesystem index — the source of truth.
 *
 * Returns the jobId of the first active job found, or null if none.
 */
export async function findActiveJobForSession(sessionId: string): Promise<string | null> {
  let files: string[];
  try {
    files = (await fs.readdir(JOB_INDEX_DIR)).filter((name) => name.endsWith(".json"));
  } catch {
    // Index dir doesn't exist yet — no jobs at all
    return null;
  }

  for (const file of files) {
    const filePath = path.join(JOB_INDEX_DIR, file);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entrySessionId = parsed.sessionId;
    const entryJobId = parsed.jobId;

    if (
      typeof entrySessionId !== "string" ||
      typeof entryJobId !== "string" ||
      entrySessionId !== sessionId
    ) {
      continue;
    }

    const status = await readJobStatusById(entryJobId);
    if (status && ACTIVE_STATUSES.has(status.status)) {
      return entryJobId;
    }
  }

  return null;
}

