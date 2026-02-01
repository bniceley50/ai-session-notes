import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceJob, createJob, deleteJob } from "./store.ts";

const practiceId = "practice-test";

const createFrozenJob = () => {
  const job = createJob(practiceId);
  const future = new Date(Date.now() + 60_000).toISOString();
  job.createdAt = future;
  job.updatedAt = future;
  if (job.statusHistory.length > 0) {
    job.statusHistory[0].at = future;
  }
  return job;
};

const cleanup = (jobId?: string) => {
  if (jobId) {
    deleteJob(jobId);
  }
};

test("advanceJob is idempotent for current status", () => {
  const job = createFrozenJob();
  try {
    const before = job.statusHistory.length;
    const result = advanceJob(job.jobId, practiceId, "queued");
    assert.ok(result);
    assert.equal(result.status, "queued");
    assert.equal(result.statusHistory.length, before);
  } finally {
    cleanup(job.jobId);
  }
});

test("advanceJob does not move backwards", () => {
  const job = createFrozenJob();
  try {
    const forward = advanceJob(job.jobId, practiceId, "transcribed");
    assert.ok(forward);
    const before = forward.statusHistory.length;
    const result = advanceJob(job.jobId, practiceId, "uploaded");
    assert.ok(result);
    assert.equal(result.status, "transcribed");
    assert.equal(result.statusHistory.length, before);
  } finally {
    cleanup(job.jobId);
  }
});

test("advanceJob appends exactly one event when moving forward", () => {
  const job = createFrozenJob();
  try {
    const before = job.statusHistory.length;
    const result = advanceJob(job.jobId, practiceId, "uploaded");
    assert.ok(result);
    assert.equal(result.statusHistory.length, before + 1);
    assert.equal(result.statusHistory.at(-1)?.status, "uploaded");
  } finally {
    cleanup(job.jobId);
  }
});

test("advanceJob never decreases progress", () => {
  const job = createFrozenJob();
  try {
    const uploaded = advanceJob(job.jobId, practiceId, "uploaded");
    assert.ok(uploaded);
    uploaded.progress = 90;
    const before = uploaded.statusHistory.length;
    const result = advanceJob(job.jobId, practiceId, "transcribed");
    assert.ok(result);
    assert.equal(result.status, "transcribed");
    assert.equal(result.progress, 90);
    assert.equal(result.statusHistory.length, before + 1);
  } finally {
    cleanup(job.jobId);
  }
});
