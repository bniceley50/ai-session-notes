import { randomUUID } from "crypto";
import type { JobRecord, JobStatus, JobStatusEvent, JobUpload } from "./types";
import { jobTtlSeconds } from "@/lib/config";

const jobs = new Map<string, JobRecord>();

export const readJobTtlSeconds = (): number => {
  return jobTtlSeconds();
};

const clampProgress = (p: number): number =>
  Math.max(0, Math.min(100, Math.round(p)));

const monotonicProgress = (current: number, next: number): number =>
  Math.max(current, next);

const STATUS_ORDER: JobStatus[] = [
  "queued",
  "uploaded",
  "transcribed",
  "drafted",
  "exported",
  "complete",
];

const statusIndex = (status: JobStatus): number => {
  if (status === "failed") return STATUS_ORDER.length;
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? 0 : index;
};

const statusProgressFloor = (status: JobStatus): number => {
  switch (status) {
    case "uploaded":
      return 5;
    case "transcribed":
      return 15;
    case "drafted":
      return 70;
    case "exported":
      return 85;
    case "complete":
      return 100;
    case "failed":
    case "queued":
    default:
      return 0;
  }
};

const applyMonotonicUpdate = (
  job: JobRecord,
  nextStatus: JobStatus,
  nextProgress: number
): JobRecord => {
  if (job.status === "failed") return job;

  const priorStatus = job.status;
  const currentIndex = statusIndex(job.status);
  const nextIndex = statusIndex(nextStatus);

  let finalStatus: JobStatus = job.status;
  if (nextStatus === "failed") {
    finalStatus = "failed";
  } else if (nextIndex > currentIndex) {
    finalStatus = nextStatus;
  }

  const finalProgress = monotonicProgress(job.progress, nextProgress);

  if (job.status !== finalStatus || job.progress !== finalProgress) {
    job.status = finalStatus;
    job.progress = finalProgress;
    job.updatedAt = new Date().toISOString();

    // Append ONLY when status changes (clean history)
    if (priorStatus !== finalStatus) {
      job.statusHistory.push({
        status: finalStatus,
        at: job.updatedAt,
        progress: finalProgress,
      });
    }
  }

  return job;
};

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

  // Tick is deterministic simulation only: never auto-fail.
  if (next.status === "failed") {
    return job;
  }

  return applyMonotonicUpdate(job, next.status, nextProgress);
};

export const createJob = (practiceId: string, sessionId: string, jobId: string = randomUUID()): JobRecord => {
  if (!sessionId) {
    throw new Error("sessionId required");
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const ttl = readJobTtlSeconds();
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

  const job: JobRecord = {
    jobId,
    practiceId,
    sessionId,
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

export const advanceJob = (
  jobId: string,
  practiceId: string,
  nextStatus: JobStatus
): JobRecord | null => {
  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== practiceId) return null;

  const currentIndex = statusIndex(job.status);
  const targetIndex = statusIndex(nextStatus);
  if (targetIndex <= currentIndex) return job;

  const nextProgress = Math.max(job.progress, statusProgressFloor(nextStatus));
  return applyMonotonicUpdate(job, nextStatus, nextProgress);
};

export const recordJobUpload = (
  jobId: string,
  practiceId: string,
  sessionId: string,
  upload: JobUpload
): JobRecord | null => {
  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== practiceId) return null;
  if (job.sessionId !== sessionId) return null;

  const previousUpdatedAt = job.updatedAt;
  const previousStatus = job.status;
  const previousProgress = job.progress;

  job.upload = upload;

  const nextProgress = Math.max(job.progress, statusProgressFloor("uploaded"));
  const updated = applyMonotonicUpdate(job, "uploaded", nextProgress);

  if (
    updated.updatedAt === previousUpdatedAt &&
    updated.status === previousStatus &&
    updated.progress === previousProgress
  ) {
    updated.updatedAt = new Date().toISOString();
  }

  return updated;
};

export const recordJobTranscribed = (
  jobId: string,
  practiceId: string,
  sessionId: string
): JobRecord | null => {
  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== practiceId) return null;
  if (job.sessionId !== sessionId) return null;

  const nextProgress = Math.max(job.progress, statusProgressFloor("transcribed"));
  return applyMonotonicUpdate(job, "transcribed", nextProgress);
};

export const recordJobDrafted = (
  jobId: string,
  practiceId: string,
  sessionId: string
): JobRecord | null => {
  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== practiceId) return null;
  if (job.sessionId !== sessionId) return null;

  const nextProgress = Math.max(job.progress, statusProgressFloor("drafted"));
  return applyMonotonicUpdate(job, "drafted", nextProgress);
};

export const recordJobExported = (
  jobId: string,
  practiceId: string,
  sessionId: string
): JobRecord | null => {
  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== practiceId) return null;
  if (job.sessionId !== sessionId) return null;

  const nextProgress = Math.max(job.progress, statusProgressFloor("exported"));
  return applyMonotonicUpdate(job, "exported", nextProgress);
};

export const recordJobCompleted = (
  jobId: string,
  practiceId: string,
  sessionId: string
): JobRecord | null => {
  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== practiceId) return null;
  if (job.sessionId !== sessionId) return null;

  const nextProgress = Math.max(job.progress, statusProgressFloor("complete"));
  return applyMonotonicUpdate(job, "complete", nextProgress);
};

export const getJobEvents = (jobId: string): JobStatusEvent[] | null => {
  const job = getJobWithProgress(jobId);
  if (!job) return null;
  return job.statusHistory;
};

export const forceJobStatus = (jobId: string, status: JobStatus): JobRecord | null => {
  const job = getJob(jobId);
  if (!job) return null;
  if (job.status === "failed") return job;
  if (status === "failed") return job;

  const currentIndex = statusIndex(job.status);
  const targetIndex = statusIndex(status);
  if (targetIndex <= currentIndex) return job;

  const updatedAt = new Date().toISOString();
  const nextProgress = Math.max(job.progress, statusProgressFloor(status));
  job.status = status;
  job.progress = nextProgress;
  job.updatedAt = updatedAt;
  job.statusHistory.push({ status, at: updatedAt, progress: nextProgress });
  return job;
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






