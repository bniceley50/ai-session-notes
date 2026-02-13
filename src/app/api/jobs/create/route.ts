import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/api/errors";
import { requireSessionOwner } from "@/lib/api/requireSessionOwner";
import { safePathSegment } from "@/lib/jobs/artifacts";
import { readAudioMetadata } from "@/lib/jobs/audio";
import { runJobPipeline, type PipelineMode } from "@/lib/jobs/pipeline";
import type { ClinicalNoteType } from "@/lib/jobs/claude";
import { acquireSessionLock, releaseSessionLock, findActiveJobForSession } from "@/lib/jobs/sessionLock";
import { createJob } from "@/lib/jobs/store";
import {
  getJobDir,
  getJobTranscriptPath,
  getSessionTranscriptPath,
  writeJobIndex,
  writeJobStatus,
  type JobStatusFile,
} from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Max length for pasted text summaries (roughly 50k chars ≈ 12k tokens) */
const MAX_TEXT_LENGTH = 50_000;

export async function POST(request: Request): Promise<Response> {
  // ── Parse payload first (sessionId is in the body, not URL) ──
  let payload: {
    sessionId?: unknown;
    audioArtifactId?: unknown;
    transcriptText?: unknown;
    mode?: unknown;
    noteType?: unknown;
  } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    payload = {};
  }

  const sessionIdRaw = typeof payload.sessionId === "string" ? payload.sessionId.trim() : "";
  if (!sessionIdRaw) {
    return jsonError(400, "BAD_REQUEST", "sessionId is required.");
  }

  // ── Auth: shared session ownership check ─────────────────────
  const auth = await requireSessionOwner(request, sessionIdRaw);
  if (!auth.ok) return auth.response;

  const { sessionId, practiceId } = auth;

  const audioArtifactId =
    typeof payload.audioArtifactId === "string" ? payload.audioArtifactId.trim() : "";
  const transcriptText =
    typeof payload.transcriptText === "string" ? payload.transcriptText.trim() : "";

  const VALID_MODES = ["transcribe", "analyze", "full"] as const;
  const VALID_NOTE_TYPES = ["soap", "dap", "birp", "girp", "intake", "progress"] as const;

  const noteType: ClinicalNoteType =
    typeof payload.noteType === "string" && VALID_NOTE_TYPES.includes(payload.noteType as ClinicalNoteType)
      ? (payload.noteType as ClinicalNoteType)
      : "soap";

  // ── Determine input mode: audio vs. text ─────────────────────
  const isTextMode = transcriptText.length > 0;

  if (!isTextMode && !audioArtifactId) {
    return jsonError(400, "BAD_REQUEST", "Provide audioArtifactId or transcriptText.");
  }

  // ── Text mode validation ─────────────────────────────────────
  if (isTextMode && transcriptText.length > MAX_TEXT_LENGTH) {
    return jsonError(400, "BAD_REQUEST", `Text too long (max ${MAX_TEXT_LENGTH.toLocaleString()} characters).`);
  }

  // ── Audio mode validation ────────────────────────────────────
  if (!isTextMode) {
    try {
      safePathSegment(audioArtifactId);
    } catch {
      return jsonError(400, "BAD_REQUEST", "Invalid audioArtifactId.");
    }

    const artifact = await readAudioMetadata(sessionId, audioArtifactId);
    if (!artifact) {
      return jsonError(404, "NOT_FOUND", "Audio artifact not found.");
    }
  }

  // Text mode always uses "analyze" (skip Whisper); audio mode uses what caller asked
  const mode: PipelineMode = isTextMode
    ? "analyze"
    : typeof payload.mode === "string" && VALID_MODES.includes(payload.mode as PipelineMode)
      ? (payload.mode as PipelineMode)
      : "full";

  // ── Concurrent job guard (session lock) ─────────────────────
  const lockAcquired = await acquireSessionLock(sessionId);
  if (!lockAcquired) {
    return jsonError(409, "CONFLICT", "Session already has an active job.");
  }

  try {
    const activeJobId = await findActiveJobForSession(sessionId);
    if (activeJobId) {
      return jsonError(409, "CONFLICT", "Session already has an active job.");
    }

    // ── Create the job ────────────────────────────────────────
    const jobId = `job_${randomUUID()}`;
    const now = new Date().toISOString();
    const status: JobStatusFile = {
      jobId,
      sessionId,
      status: "queued",
      stage: mode === "analyze" ? "draft" : "transcribe",
      progress: 0,
      updatedAt: now,
      errorMessage: null,
    };

    await writeJobIndex(jobId, sessionId);
    await writeJobStatus(status);

    const jobDir = getJobDir(sessionId, jobId);
    await fs.mkdir(jobDir, { recursive: true });

    const jobMeta = {
      jobId,
      sessionId,
      ...(isTextMode ? { inputMode: "text" } : { audioArtifactId }),
      createdAt: now,
    };
    await fs.writeFile(path.join(jobDir, "job.json"), JSON.stringify(jobMeta, null, 2), "utf8");

    // ── Text mode: pre-write transcript so analyze-only pipeline can load it
    if (isTextMode) {
      const formattedTranscript = `Text Summary\n\nSubmitted: ${now}\n\n---\n\n${transcriptText}\n`;

      const writeTextFile = async (filePath: string, content: string) => {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf8");
      };

      // Write both job-level and session-level transcript (matches pipeline convention)
      await writeTextFile(getJobTranscriptPath(sessionId, jobId), formattedTranscript);
      await writeTextFile(getSessionTranscriptPath(sessionId), formattedTranscript);
    }

    try {
      createJob(practiceId, sessionId, jobId);
    } catch {
      // Best-effort compatibility with legacy job routes.
    }

    setTimeout(() => {
      void runJobPipeline({
        sessionId,
        jobId,
        artifactId: isTextMode ? "" : audioArtifactId,
        mode,
        noteType,
      });
    }, 0);

    return NextResponse.json({
      jobId,
      sessionId,
      statusUrl: `/api/jobs/${jobId}`,
    });
  } finally {
    await releaseSessionLock(sessionId);
  }
}
