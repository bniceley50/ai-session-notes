import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT, safePathSegment } from "@/lib/jobs/artifacts";

export type JobStage = "upload" | "transcribe" | "draft" | "export";
export type JobStatus = "queued" | "running" | "complete" | "failed" | "deleted";

export type JobStatusFile = {
  jobId: string;
  sessionId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  updatedAt: string;
  errorMessage: string | null;
};

const JOB_INDEX_DIR = path.resolve(ARTIFACTS_ROOT, "_index", "jobs");

export const getSessionDir = (sessionId: string): string =>
  path.resolve(ARTIFACTS_ROOT, "sessions", safePathSegment(sessionId));

export const getSessionJobsDir = (sessionId: string): string =>
  path.resolve(getSessionDir(sessionId), "jobs");

/** Session-level transcript (shared across jobs so analyze-only can find it) */
export const getSessionTranscriptPath = (sessionId: string): string =>
  path.join(getSessionDir(sessionId), "transcript", "latest.txt");

export const getJobDir = (sessionId: string, jobId: string): string =>
  path.resolve(getSessionJobsDir(sessionId), safePathSegment(jobId));

export const getJobStatusPath = (sessionId: string, jobId: string): string =>
  path.join(getJobDir(sessionId, jobId), "status.json");

export const getJobTranscriptPath = (sessionId: string, jobId: string): string =>
  path.join(getJobDir(sessionId, jobId), "transcript", "transcript.txt");

export const getJobDraftPath = (sessionId: string, jobId: string): string =>
  path.join(getJobDir(sessionId, jobId), "draft", "note.md");

export const getJobExportPath = (sessionId: string, jobId: string): string =>
  path.join(getJobDir(sessionId, jobId), "export", "note.txt");

export const getJobLogPath = (sessionId: string, jobId: string): string =>
  path.join(getJobDir(sessionId, jobId), "logs", "pipeline.log");

export const getJobIndexPath = (jobId: string): string =>
  path.resolve(JOB_INDEX_DIR, `${safePathSegment(jobId)}.json`);

export const writeJobIndex = async (
  jobId: string,
  sessionId: string,
  createdAt = new Date().toISOString()
): Promise<void> => {
  await fs.mkdir(JOB_INDEX_DIR, { recursive: true });
  const payload = { jobId, sessionId, createdAt };
  await fs.writeFile(getJobIndexPath(jobId), JSON.stringify(payload, null, 2), "utf8");
};

export const readJobIndex = async (
  jobId: string
): Promise<{ jobId: string; sessionId: string; createdAt?: string } | null> => {
  try {
    const raw = await fs.readFile(getJobIndexPath(jobId), "utf8");
    const data = JSON.parse(raw) as {
      jobId?: unknown;
      sessionId?: unknown;
      createdAt?: unknown;
    };
    if (typeof data?.jobId !== "string" || typeof data?.sessionId !== "string") return null;
    return {
      jobId: data.jobId,
      sessionId: data.sessionId,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    };
  } catch {
    return null;
  }
};

export const writeJobStatus = async (status: JobStatusFile): Promise<void> => {
  const jobDir = getJobDir(status.sessionId, status.jobId);
  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(
    getJobStatusPath(status.sessionId, status.jobId),
    JSON.stringify(status, null, 2),
    "utf8"
  );
};

export const readJobStatusById = async (jobId: string): Promise<JobStatusFile | null> => {
  const index = await readJobIndex(jobId);
  if (!index) return null;
  try {
    const raw = await fs.readFile(getJobStatusPath(index.sessionId, jobId), "utf8");
    const data = JSON.parse(raw) as JobStatusFile;
    if (!data || typeof data !== "object") return null;
    if (data.jobId !== jobId || typeof data.sessionId !== "string") return null;
    return data;
  } catch {
    return null;
  }
};

export const updateJobStatus = async (
  jobId: string,
  update: Partial<JobStatusFile>
): Promise<JobStatusFile | null> => {
  const current = await readJobStatusById(jobId);
  if (!current) return null;
  const next: JobStatusFile = {
    ...current,
    ...update,
    jobId: current.jobId,
    sessionId: current.sessionId,
    updatedAt: new Date().toISOString(),
  };
  await writeJobStatus(next);
  return next;
};
