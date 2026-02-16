/**
 * Tests for session-level lock and concurrent job guard.
 *
 * Verifies:
 * - acquireSessionLock succeeds on first call, fails on second (contention)
 * - releaseSessionLock removes the lock file
 * - findActiveJobForSession returns active job ID for queued/running jobs
 * - findActiveJobForSession returns null for complete/failed/deleted jobs
 * - findActiveJobForSession returns null when no jobs exist
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, test, beforeEach } from "node:test";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import {
  getSessionDir,
  writeJobIndex,
  writeJobStatus,
  type JobStatusFile,
  type JobStatus,
} from "@/lib/jobs/status";
import {
  acquireSessionLock,
  releaseSessionLock,
  findActiveJobForSession,
} from "./sessionLock";

const indexDir = path.resolve(ARTIFACTS_ROOT, "_index", "jobs");

async function seedJobWithStatus(
  jobId: string,
  sessionId: string,
  status: JobStatus,
): Promise<void> {
  await writeJobIndex(jobId, sessionId);

  const statusFile: JobStatusFile = {
    jobId,
    sessionId,
    status,
    stage: "transcribe",
    progress: 0,
    updatedAt: new Date().toISOString(),
    errorMessage: null,
  };
  await writeJobStatus(statusFile);
}

async function cleanSession(sessionId: string): Promise<void> {
  try {
    await fs.rm(getSessionDir(sessionId), { recursive: true, force: true });
  } catch {
    // ok
  }
}

async function cleanIndex(jobId: string): Promise<void> {
  try {
    await fs.rm(path.join(indexDir, `${jobId}.json`), { force: true });
  } catch {
    // ok
  }
}

describe("acquireSessionLock / releaseSessionLock", () => {
  const sessionId = `sess-lock-test-${Date.now()}`;

  beforeEach(async () => {
    await releaseSessionLock(sessionId);
  });

  test("first acquire succeeds", async () => {
    const acquired = await acquireSessionLock(sessionId);
    assert.equal(acquired, true);
    await releaseSessionLock(sessionId);
  });

  test("second acquire fails (contention)", async () => {
    const first = await acquireSessionLock(sessionId);
    assert.equal(first, true);

    const second = await acquireSessionLock(sessionId);
    assert.equal(second, false);

    await releaseSessionLock(sessionId);
  });

  test("release allows re-acquire", async () => {
    await acquireSessionLock(sessionId);
    await releaseSessionLock(sessionId);

    const reacquired = await acquireSessionLock(sessionId);
    assert.equal(reacquired, true);
    await releaseSessionLock(sessionId);
  });
});

describe("findActiveJobForSession", () => {
  const sessionId = `sess-active-${Date.now()}`;
  const jobId = `job-active-${Date.now()}`;

  beforeEach(async () => {
    await cleanSession(sessionId);
    await cleanIndex(jobId);
  });

  test("returns null when no jobs exist", async () => {
    const result = await findActiveJobForSession(`sess-empty-${Date.now()}`);
    assert.equal(result, null);
  });

  test("returns jobId when job is queued", async () => {
    await seedJobWithStatus(jobId, sessionId, "queued");
    const result = await findActiveJobForSession(sessionId);
    assert.equal(result, jobId);
    await cleanSession(sessionId);
    await cleanIndex(jobId);
  });

  test("returns jobId when job is running", async () => {
    const runJobId = `job-running-${Date.now()}`;
    await seedJobWithStatus(runJobId, sessionId, "running");
    const result = await findActiveJobForSession(sessionId);
    assert.equal(result, runJobId);
    await cleanSession(sessionId);
    await cleanIndex(runJobId);
  });

  test("returns null when job is complete", async () => {
    const doneJobId = `job-done-${Date.now()}`;
    await seedJobWithStatus(doneJobId, sessionId, "complete");
    const result = await findActiveJobForSession(sessionId);
    assert.equal(result, null);
    await cleanSession(sessionId);
    await cleanIndex(doneJobId);
  });

  test("returns null when job is failed", async () => {
    const failJobId = `job-fail-${Date.now()}`;
    await seedJobWithStatus(failJobId, sessionId, "failed");
    const result = await findActiveJobForSession(sessionId);
    assert.equal(result, null);
    await cleanSession(sessionId);
    await cleanIndex(failJobId);
  });

  test("returns null when job is deleted", async () => {
    const delJobId = `job-del-${Date.now()}`;
    await seedJobWithStatus(delJobId, sessionId, "deleted");
    const result = await findActiveJobForSession(sessionId);
    assert.equal(result, null);
    await cleanSession(sessionId);
    await cleanIndex(delJobId);
  });

  test("finds active job among mixed statuses", async () => {
    const sess = `sess-mixed-${Date.now()}`;
    const doneJob = `job-mixed-done-${Date.now()}`;
    const activeJob = `job-mixed-active-${Date.now()}`;

    await seedJobWithStatus(doneJob, sess, "complete");
    await seedJobWithStatus(activeJob, sess, "queued");

    const result = await findActiveJobForSession(sess);
    assert.equal(result, activeJob);

    await cleanSession(sess);
    await cleanIndex(doneJob);
    await cleanIndex(activeJob);
  });
});

