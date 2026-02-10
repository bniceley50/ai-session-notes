// Pipeline integration tests — calls runJobPipeline() directly.
//
// TODO: When real Whisper/LLM APIs are wired in, these tests MUST be updated.
// Currently the pipeline writes deterministic placeholder content with no
// external API calls, so it's safe to run without stub flags.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import { runJobPipeline } from "@/lib/jobs/pipeline";
import { writeJobIndex, writeJobStatus, type JobStatusFile } from "@/lib/jobs/status";
import { writeAudioMetadata } from "@/lib/jobs/audio";

// ARTIFACTS_ROOT was set to a temp dir by setup-env.ts (via --import).
const artifactsRoot = path.resolve(ARTIFACTS_ROOT);

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
  test("writes transcript, draft, export, and log files", async () => {
    const sessionId = "sess-pipe-1";
    const jobId = "job-pipe-1";
    const artifactId = "art-pipe-1";

    await seedFullJob(sessionId, jobId, artifactId);
    await runJobPipeline({ sessionId, jobId, artifactId });

    const jobDir = path.join(artifactsRoot, "sessions", sessionId, "jobs", jobId);

    // transcript exists and is non-empty
    const transcript = await fs.readFile(path.join(jobDir, "transcript", "transcript.txt"), "utf8");
    assert.ok(transcript.length > 0, "transcript must be non-empty");
    assert.ok(transcript.includes("Transcript"), "transcript must contain placeholder text");

    // draft exists and is non-empty
    const draft = await fs.readFile(path.join(jobDir, "draft", "note.md"), "utf8");
    assert.ok(draft.length > 0, "draft must be non-empty");
    assert.ok(draft.includes("SOAP"), "draft must contain SOAP note placeholder");

    // export exists and is non-empty
    const exportText = await fs.readFile(path.join(jobDir, "export", "note.txt"), "utf8");
    assert.ok(exportText.length > 0, "export must be non-empty");

    // log exists and records pipeline start + complete
    const log = await fs.readFile(path.join(jobDir, "logs", "pipeline.log"), "utf8");
    assert.ok(log.includes("pipeline start"), "log must record pipeline start");
    assert.ok(log.includes("pipeline complete"), "log must record pipeline complete");

    // Final status is complete with progress 100
    const statusRaw = await fs.readFile(path.join(jobDir, "status.json"), "utf8");
    const status = JSON.parse(statusRaw) as { status: string; progress: number };
    assert.equal(status.status, "complete");
    assert.equal(status.progress, 100);
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
  });

  test("missing audio metadata → pipeline still completes (uses fallback summary)", async () => {
    const sessionId = "sess-pipe-noaudio";
    const jobId = "job-pipe-noaudio";
    const artifactId = "art-nonexistent";

    // Seed job but NOT audio metadata
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

    await runJobPipeline({ sessionId, jobId, artifactId });

    const jobDir = path.join(artifactsRoot, "sessions", sessionId, "jobs", jobId);

    // Pipeline should still complete (audio metadata is optional for stub)
    const statusRaw = await fs.readFile(path.join(jobDir, "status.json"), "utf8");
    const finalStatus = JSON.parse(statusRaw) as { status: string };
    assert.equal(finalStatus.status, "complete", "pipeline should complete even without audio metadata");
  });
});
