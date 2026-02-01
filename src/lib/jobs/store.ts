import { randomUUID } from "crypto";
import type { JobRecord, JobStatus, JobStatusEvent } from "./types";

const jobs = new Map<string, JobRecord>();

export const readJobTtlSeconds = (): number => {
  const raw = process.env.JOB_TTL_SECONDS;
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    return 86400;
  }
  return Math.floor(value);
};

const clampProgress = (p: number): number =>
  Math.max(0, Math.min(100, Math.round(p)));

const computeStatusFromElapsed = (
  elapsedSeconds: number
): { status: JobStatus; progress: number } => {
  // Default schedule (seconds since created):
  // queued: 0–3
  // uploaded: 3–5
  // transcribed: 5–12
  // drafted: 12–16
  // exported: 16–19
  // complete: 19+
  if (elapsedSeconds < 3) {
    return { status: "queued", progress: (elapsedSeconds / 3) * 5 }; // 0..5
  }
  if (elapsedSeconds < 5) {
    return { status: "uploaded", progress: 5 + ((elapsedSeconds - 3) / 2) * 10 }; // 5..15
  }
  if (elapsedSeconds < 12) {
    return {
      status: "transcribed",
      progress: 15 + ((elapsedSeconds - 5) / 7) * 55, // 15..70
    };
  }
  if (elapsedSeconds < 16) {
    return {
      status: "drafted",
      progress: 70 + ((elapsedSeconds - 12) / 4) * 15, // 70..85
    };
  }
  if (elapsedSeconds < 19) {
    return {
      status: "exported",
      progress: 85 + ((elapsedSeconds - 16) / 3) * 14, // 85..99
    };
  }
  return { status: "complete", progress: 100 };
};

const tickJob = (job: JobRecord): JobRecord => {
  if (job.status === "failed") return job;
  if (job.status === "complete" && job.progress >= 100) return job;

  const createdAtMs = Date.parse(job.createdAt);
  if (!Number.isFinite(createdAtMs)) return job;

  const elapsedSeconds = Math.max(0, (Date.now() - createdAtMs) / 1000);
  const next = computeStatusFromElapsed(elapsedSeconds);
  const nextProgress = clampProgress(next.progress);

  const priorStatus = job.status;

  if (job.status !== next.status || job.progress !== nextProgress) {
    job.status = next.status;
    job.progress = nextProgress;
    job.updatedAt = new Date().toISOString();

    // Append ONLY when status changes (clean history)
    if (priorStatus !== next.status) {
      job.statusHistory.push({
        status: next.status,
        at: job.updatedAt,
        progress: nextProgress,
      });
    }
  }

  return job;
};

export const createJob = (practiceId: string): JobRecord => {
  const now = new Date();
  const createdAt = now.toISOString();
  const ttl = readJobTtlSeconds();
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

  const job: JobRecord = {
    jobId: randomUUID(),
    practiceId,
    status: "queued",
    progress: 0,
    createdAt,
    updatedAt: createdAt,
    statusHistory: [{ status: "queued", at: createdAt, progress: 0 }],
    expiresAt,
  };

  jobs.set(job.jobId, job);
  return job;
};

export const getJob = (jobId: string): JobRecord | null => jobs.get(jobId) ?? null;

export const getJobWithProgress = (jobId: string): JobRecord | null => {
  const job = getJob(jobId);
  if (!job) return null;

  // Opportunistic expiry cleanup
  if (Date.parse(job.expiresAt) <= Date.now()) {
    jobs.delete(jobId);
    return null;
  }

  return tickJob(job);
};

export const getJobEvents = (jobId: string): JobStatusEvent[] | null => {
  const job = getJobWithProgress(jobId);
  if (!job) return null;
  return job.statusHistory;
};

export const deleteJob = (jobId: string): boolean => jobs.delete(jobId);

export const purgeExpired = (): number => {
  const now = Date.now();
  let purged = 0;
  for (const [id, job] of jobs.entries()) {
    if (Date.parse(job.expiresAt) <= now) {
      jobs.delete(id);
      purged += 1;
    }
  }
  return purged;
};
