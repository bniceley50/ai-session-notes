// Pipeline integration tests — calls runJobPipeline() in STUB mode.
//
// The pipeline requires AI_ENABLE_STUB_APIS=1 (or AI_ENABLE_REAL_APIS=1) to run.
// Tests use stub mode so no external API calls are made.

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import { runJobPipeline } from "@/lib/jobs/pipeline";
import { getJobTranscriptPath, getJobDraftPath, getSessionTranscriptPath, writeJobIndex, writeJobStatus, type JobStatusFile } from "@/lib/jobs/status";
import { writeAudioMetadata } from "@/lib/jobs/audio";
import type { JobState } from "@/lib/jobs/jobState";

// ARTIFACTS_ROOT was set to a temp dir by setup-env.ts (via --import).
const artifactsRoot = path.resolve(ARTIFACTS_ROOT);

// ---------------------------------------------------------------------------
// Enable stub mode for the entire suite
// ---------------------------------------------------------------------------
let origStub: string | undefined;
let origReal: string | undefined;

before(() => {
  origStub = process.env.AI_ENABLE_STUB_APIS;
  origReal = process.env.AI_ENABLE_REAL_APIS;
  process.env.AI_ENABLE_STUB_APIS = "1";
  delete process.env.AI_ENABLE_REAL_APIS;
});

after(() => {
  if (origStub === undefined) delete process.env.AI_ENABLE_STUB_APIS;
  else process.env.AI_ENABLE_STUB_APIS = origStub;
  if (origReal === undefined) delete process.env.AI_ENABLE_REAL_APIS;
  else process.env.AI_ENABLE_REAL_APIS = origReal;
});

// ---------------------------------------------------------------------------
// Seed helpers — use library functions directly (they write to ARTIFACTS_ROOT)
// ---------------------------------------------------------------------------

async function seedFullJob(sessionId: string, jobId: string, artifactId: string) {
  await writeJobIndex(jobId, sessionId);
  const status: JobStatusFile = {
    jobId,
    sessionId,
    status: "queued",
    stage: "transcribe",
    progress: 0,
    updatedAt: new Date().toISOString(),
    errorMessage: null,
  };
  await writeJobStatus(status);
  await writeAudioMetadata({
    artifactId,
    sessionId,
    filename: "recording.webm",
    storedName: `${artifactId}.webm`,
    mime: "audio/webm",
    bytes: 1024,
    createdAt: new Date().toISOString(),
  });
}

async function seedDeletedJob(sessionId: string, jobId: string, artifactId: string) {
  await writeJobIndex(jobId, sessionId);
  const status: JobStatusFile = {
    jobId,
    sessionId,
    status: "deleted",
    stage: "upload",
    progress: 0,
    updatedAt: new Date().toISOString(),
    errorMessage: null,
  };
  await writeJobStatus(status);
  await writeAudioMetadata({
    artifactId,
    sessionId,
    filename: "recording.webm",
    storedName: `${artifactId}.webm`,
    mime: "audio/webm",
    bytes: 1024,
    createdAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runJobPipeline", () => {
  test("stub mode writes transcript, draft, and log files", async () => {
    const sessionId = "sess-pipe-1";
    const jobId = "job-pipe-1";
    const artifactId = "art-pipe-1";

    await seedFullJob(sessionId, jobId, artifactId);
    await runJobPipeline({ sessionId, jobId, artifactId });

    const jobDir = path.join(artifactsRoot, "sessions", sessionId, "jobs", jobId);

    // transcript exists and contains stub marker
    const transcript = await fs.readFile(path.join(jobDir, "transcript", "transcript.txt"), "utf8");
    assert.ok(transcript.length > 0, "transcript must be non-empty");
    assert.ok(transcript.includes("STUB"), "transcript must contain STUB marker");

    // draft exists and contains SOAP stub marker
    const draft = await fs.readFile(path.join(jobDir, "draft", "note.md"), "utf8");
    assert.ok(draft.length > 0, "draft must be non-empty");
    assert.ok(draft.includes("SOAP Note (Demo Mode)"), "draft must contain SOAP stub marker");

    // log exists and records pipeline start + complete
    const log = await fs.readFile(path.join(jobDir, "logs", "pipeline.log"), "utf8");
    assert.ok(log.includes("pipeline start"), "log must record pipeline start");
    assert.ok(log.includes("pipeline complete"), "log must record pipeline complete");

    // Final status is complete with progress 100
    const statusRaw = await fs.readFile(path.join(jobDir, "status.json"), "utf8");
    const status = JSON.parse(statusRaw) as { status: string; progress: number };
    assert.equal(status.status, "complete");
    assert.equal(status.progress, 100);

    // runner.lock must be cleaned up after pipeline completes
    const lockExists = await fs
      .access(path.join(jobDir, "runner.lock"))
      .then(() => true)
      .catch(() => false);
    assert.equal(lockExists, false, "runner.lock must be removed after successful pipeline");

    // No .tmp- files should remain anywhere in the job directory
    const allFiles = await fs.readdir(jobDir, { recursive: true });
    const temps = (allFiles as string[]).filter((f) => f.includes(".tmp-"));
    assert.equal(temps.length, 0, "no .tmp- files should remain after successful pipeline");

    // state.json records final complete state
    const stateRaw = await fs.readFile(path.join(jobDir, "state.json"), "utf8");
    const state = JSON.parse(stateRaw) as JobState;
    assert.equal(state.status, "complete", "state.json must show complete");
    assert.equal(state.stage, "export", "state.json must show final stage as export");
    assert.ok(state.updatedAt, "state.json must have updatedAt");
    assert.equal(state.error, undefined, "state.json must not have error on success");
  });

  test("deleted job exits early without writing files", async () => {
    const sessionId = "sess-pipe-del";
    const jobId = "job-pipe-del";
    const artifactId = "art-pipe-del";

    await seedDeletedJob(sessionId, jobId, artifactId);
    await runJobPipeline({ sessionId, jobId, artifactId });

    const jobDir = path.join(artifactsRoot, "sessions", sessionId, "jobs", jobId);

    // Transcript should NOT have been written
    const transcriptExists = await fs
      .access(path.join(jobDir, "transcript", "transcript.txt"))
      .then(() => true)
      .catch(() => false);
    assert.equal(transcriptExists, false, "deleted job must not write transcript");

    // runner.lock must be cleaned up even for early exit
    const lockExists = await fs
      .access(path.join(jobDir, "runner.lock"))
      .then(() => true)
      .catch(() => false);
    assert.equal(lockExists, false, "runner.lock must be removed after deleted-job early exit");
  });

  test("no API flags → pipeline fails gracefully", async () => {
    const sessionId = "sess-pipe-noflag";
    const jobId = "job-pipe-noflag";
    const artifactId = "art-pipe-noflag";

    // Temporarily disable both flags
    const savedStub = process.env.AI_ENABLE_STUB_APIS;
    const savedReal = process.env.AI_ENABLE_REAL_APIS;
    delete process.env.AI_ENABLE_STUB_APIS;
    delete process.env.AI_ENABLE_REAL_APIS;

    try {
      await seedFullJob(sessionId, jobId, artifactId);
      await runJobPipeline({ sessionId, jobId, artifactId });

      const jobDir = path.join(artifactsRoot, "sessions", sessionId, "jobs", jobId);
      const statusRaw = await fs.readFile(path.join(jobDir, "status.json"), "utf8");
      const status = JSON.parse(statusRaw) as { status: string; errorMessage: string | null };
      assert.equal(status.status, "failed", "pipeline must fail without API flags");
      assert.ok(
        status.errorMessage?.includes("disabled"),
        "error message must mention APIs are disabled"
      );

      // runner.lock must be cleaned up even on failure
      const lockExists = await fs
        .access(path.join(jobDir, "runner.lock"))
        .then(() => true)
        .catch(() => false);
      assert.equal(lockExists, false, "runner.lock must be removed after pipeline failure");

      // state.json records failure with error details
      const stateRaw = await fs.readFile(path.join(jobDir, "state.json"), "utf8");
      const state = JSON.parse(stateRaw) as JobState;
      assert.equal(state.status, "failed", "state.json must show failed");
      assert.ok(state.error, "state.json must have error object on failure");
      assert.ok(state.error.message.includes("disabled"), "state.json error must mention APIs are disabled");
    } finally {
      // Restore flags
      if (savedStub !== undefined) process.env.AI_ENABLE_STUB_APIS = savedStub;
      if (savedReal !== undefined) process.env.AI_ENABLE_REAL_APIS = savedReal;
    }
  });

  test("re-running pipeline skips stages when outputs already exist", async () => {
    const sessionId = "sess-pipe-idem";
    const jobId = "job-pipe-idem";
    const artifactId = "art-pipe-idem";

    // First run — produces all outputs
    await seedFullJob(sessionId, jobId, artifactId);
    await runJobPipeline({ sessionId, jobId, artifactId });

    // Capture mtimes of outputs after first run
    const jobTranscriptPath = getJobTranscriptPath(sessionId, jobId);
    const sessionTranscriptPath = getSessionTranscriptPath(sessionId);
    const draftPath = getJobDraftPath(sessionId, jobId);
    const jobDir = path.join(artifactsRoot, "sessions", sessionId, "jobs", jobId);

    const mtime1 = {
      jobTranscript: (await fs.stat(jobTranscriptPath)).mtimeMs,
      sessionTranscript: (await fs.stat(sessionTranscriptPath)).mtimeMs,
      draft: (await fs.stat(draftPath)).mtimeMs,
    };

    // Reset job status to "queued" so pipeline will run again
    const resetStatus: JobStatusFile = {
      jobId,
      sessionId,
      status: "queued",
      stage: "transcribe",
      progress: 0,
      updatedAt: new Date().toISOString(),
      errorMessage: null,
    };
    await writeJobStatus(resetStatus);

    // Second run — should skip all stages
    await runJobPipeline({ sessionId, jobId, artifactId });

    // Verify outputs were NOT rewritten (mtimes unchanged)
    const mtime2 = {
      jobTranscript: (await fs.stat(jobTranscriptPath)).mtimeMs,
      sessionTranscript: (await fs.stat(sessionTranscriptPath)).mtimeMs,
      draft: (await fs.stat(draftPath)).mtimeMs,
    };

    assert.equal(mtime2.jobTranscript, mtime1.jobTranscript, "job transcript must not be rewritten");
    assert.equal(mtime2.sessionTranscript, mtime1.sessionTranscript, "session transcript must not be rewritten");
    assert.equal(mtime2.draft, mtime1.draft, "draft must not be rewritten");

    // state.json still shows complete/export
    const stateRaw = await fs.readFile(path.join(jobDir, "state.json"), "utf8");
    const state = JSON.parse(stateRaw) as JobState;
    assert.equal(state.status, "complete", "state.json must show complete after re-run");
    assert.equal(state.stage, "export", "state.json must show export stage after re-run");

    // Log should contain skip messages
    const log = await fs.readFile(path.join(jobDir, "logs", "pipeline.log"), "utf8");
    assert.ok(log.includes("transcribe skipped"), "log must record transcribe skip");
    assert.ok(log.includes("draft skipped"), "log must record draft skip");
  });
});
