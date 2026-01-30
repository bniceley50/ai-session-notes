import { randomUUID } from "crypto";
import type { JobRecord } from "./types";

const jobs = new Map<string, JobRecord>();

export const readJobTtlSeconds = (): number => {
  const raw = process.env.JOB_TTL_SECONDS;
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    return 86400;
  }
  return Math.floor(value);
};

export const createJob = (practiceId: string): JobRecord => {
  const now = new Date();
  const ttl = readJobTtlSeconds();
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  const job: JobRecord = {
    id: randomUUID(),
    practiceId,
    status: "created",
    createdAt: now.toISOString(),
    expiresAt,
  };
  jobs.set(job.id, job);
  return job;
};

export const getJob = (id: string): JobRecord | null => jobs.get(id) ?? null;

export const deleteJob = (id: string): boolean => jobs.delete(id);

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