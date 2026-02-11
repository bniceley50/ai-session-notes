import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { safePathSegment } from "@/lib/jobs/artifacts";
import { readAudioMetadata } from "@/lib/jobs/audio";
import { runJobPipeline, type PipelineMode } from "@/lib/jobs/pipeline";
import type { ClinicalNoteType } from "@/lib/jobs/claude";
import { createJob } from "@/lib/jobs/store";
import { readSessionOwnership } from "@/lib/sessions/ownership";
import { getJobDir, writeJobIndex, writeJobStatus, type JobStatusFile } from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  let payload: { sessionId?: unknown; audioArtifactId?: unknown; mode?: unknown; noteType?: unknown } = {};
  try {
    payload = (await request.json()) as { sessionId?: unknown; audioArtifactId?: unknown; mode?: unknown; noteType?: unknown };
  } catch {
    payload = {};
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.trim() : "";
  const audioArtifactId =
    typeof payload.audioArtifactId === "string" ? payload.audioArtifactId.trim() : "";
  const VALID_MODES = ["transcribe", "analyze", "full"] as const;
  const mode: PipelineMode =
    typeof payload.mode === "string" && VALID_MODES.includes(payload.mode as PipelineMode)
      ? (payload.mode as PipelineMode)
      : "full";
  const VALID_NOTE_TYPES = ["soap", "dap", "birp", "girp", "intake", "progress"] as const;
  const noteType: ClinicalNoteType =
    typeof payload.noteType === "string" && VALID_NOTE_TYPES.includes(payload.noteType as ClinicalNoteType)
      ? (payload.noteType as ClinicalNoteType)
      : "soap";

  if (!sessionId || !audioArtifactId) {
    return jsonError(400, "BAD_REQUEST", "sessionId and audioArtifactId required.");
  }

  try {
    safePathSegment(sessionId);
    safePathSegment(audioArtifactId);
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid sessionId or audioArtifactId.");
  }

  const ownership = await readSessionOwnership(sessionId);
  if (!ownership || ownership.ownerUserId !== session.sub) {
    return jsonError(404, "NOT_FOUND", "Session not found or not accessible.");
  }

  const artifact = await readAudioMetadata(sessionId, audioArtifactId);
  if (!artifact) {
    return jsonError(404, "NOT_FOUND", "Audio artifact not found.");
  }

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
  const jobMeta = { jobId, sessionId, audioArtifactId, createdAt: now };
  await fs.writeFile(path.join(jobDir, "job.json"), JSON.stringify(jobMeta, null, 2), "utf8");

  try {
    createJob(session.practiceId, sessionId, jobId);
  } catch {
    // Best-effort compatibility with legacy job routes.
  }

  setTimeout(() => {
    void runJobPipeline({ sessionId, jobId, artifactId: audioArtifactId, mode, noteType });
  }, 0);

  return NextResponse.json({
    jobId,
    sessionId,
    statusUrl: `/api/jobs/${jobId}`,
  });
}



