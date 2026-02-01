import { randomUUID } from "crypto";
import type { JobRecord, JobStatus } from "./types";

const jobs = new Map<string, JobRecord>();

export const readJobTtlSeconds = (): number => {
  const raw = process.env.JOB_TTL_SECONDS;
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    return 86400;
  }
  return Math.floor(value);
};

const computeStatusFromElapsed = (
  elapsedSeconds: number
): { status: JobStatus; progress: number } => {
  if (elapsedSeconds < 3) {
    return { status: "queued", progress: (elapsedSeconds / 3) * 5 };
  }
  if (elapsedSeconds < 15) {
    return { status: "running", progress: 5 + ((elapsedSeconds - 3) / 12) * 85 };
  }
  if (elapsedSeconds < 20) {
    return { status: "running", progress: 90 + ((elapsedSeconds - 15) / 5) * 9 };
  }
  return { status: "complete", progress: 100 };
};

const clampProgress = (p: number): number =>
  Math.max(0, Math.min(100, Math.round(p)));

const tickJob = (job: JobRecord): JobRecord => {
  if (job.status === "failed") return job;
  if (job.status === "complete" && job.progress >= 100) return job;

  const createdAtMs = Date.parse(job.createdAt);
  if (!Number.isFinite(createdAtMs)) return job;

  const elapsedSeconds = Math.max(0, (Date.now() - createdAtMs) / 1000);
  const next = computeStatusFromElapsed(elapsedSeconds);
  const nextProgress = clampProgress(next.progress);

  if (job.status !== next.status || job.progress !== nextProgress) {
    job.status = next.status;
    job.progress = nextProgress;
    job.updatedAt = new Date().toISOString();
  }

  return job;
};

export const createJob = (practiceId: string): JobRecord => {
  const now = new Date();
  const ttl = readJobTtlSeconds();
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

  const job: JobRecord = {
    jobId: randomUUID(),
    practiceId,
    status: "queued",
    progress: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
  };

  jobs.set(job.jobId, job);
  return job;
};

export const getJob = (jobId: string): JobRecord | null => jobs.get(jobId) ?? null;

export const getJobWithProgress = (jobId: string): JobRecord | null => {
  const job = getJob(jobId);
  if (!job) return null;
  return tickJob(job);
};

export const deleteJob = (jobId: string): boolean => jobs.delete(jobId);

export const purgeExpired = (): number => {
  const now = Date.now();
  let purged = 0;

  for (const [jobId, job] of jobs.entries()) {
    if (Date.parse(job.expiresAt) <= now) {
      jobs.delete(jobId);
      purged += 1;
    }
  }

  return purged;
};
