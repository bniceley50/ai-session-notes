import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import { cleanupJobArtifacts } from "@/lib/jobs/cleanup";
import { getSessionDir, getSessionJobsDir } from "@/lib/jobs/status";
import { deleteJob, readJobTtlSeconds } from "@/lib/jobs/store";

const JOB_INDEX_DIR = path.resolve(ARTIFACTS_ROOT, "_index", "jobs");

type JobIndexEntry = {
  jobId: string;
  sessionId: string;
  createdAt?: string;
};

export type PurgeResult = {
  scannedJobs: number;
  purgedJobs: number;
  purgedSessions: number;
};

const isExpired = (createdAt: string | undefined, ttlSeconds: number, nowMs: number): boolean => {
  if (!createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return false;
  return createdAtMs + ttlSeconds * 1000 <= nowMs;
};

const readJobIndexEntry = async (filePath: string): Promise<JobIndexEntry | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<JobIndexEntry>;
    if (typeof parsed.jobId !== "string" || typeof parsed.sessionId !== "string") {
      return null;
    }
    return {
      jobId: parsed.jobId,
      sessionId: parsed.sessionId,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
    };
  } catch {
    return null;
  }
};

const sessionHasAnyJobs = async (sessionId: string): Promise<boolean> => {
  try {
    const entries = await fs.readdir(getSessionJobsDir(sessionId));
    return entries.length > 0;
  } catch {
    return false;
  }
};

export async function purgeExpiredJobArtifacts(nowMs = Date.now()): Promise<PurgeResult> {
  const result: PurgeResult = {
    scannedJobs: 0,
    purgedJobs: 0,
    purgedSessions: 0,
  };

  let files: string[] = [];
  try {
    files = (await fs.readdir(JOB_INDEX_DIR)).filter((name) => name.endsWith(".json"));
  } catch {
    return result;
  }

  const ttlSeconds = readJobTtlSeconds();
  const touchedSessions = new Set<string>();

  for (const file of files) {
    const filePath = path.join(JOB_INDEX_DIR, file);
    const entry = await readJobIndexEntry(filePath);
    if (!entry) continue;

    result.scannedJobs += 1;
    if (!isExpired(entry.createdAt, ttlSeconds, nowMs)) continue;

    await cleanupJobArtifacts(entry.sessionId, entry.jobId);
    deleteJob(entry.jobId);
    result.purgedJobs += 1;
    touchedSessions.add(entry.sessionId);
  }

  for (const sessionId of touchedSessions) {
    const keepSession = await sessionHasAnyJobs(sessionId);
    if (keepSession) continue;
    try {
      await fs.rm(getSessionDir(sessionId), { recursive: true, force: true });
      result.purgedSessions += 1;
    } catch {
      // best effort cleanup only
    }
  }

  return result;
}
