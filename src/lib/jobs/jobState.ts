import path from "node:path";
import fs from "node:fs/promises";
import { type JobStage, type JobStatus, getJobDir } from "@/lib/jobs/status";
import { writeFileAtomic } from "@/lib/fs/writeFileAtomic";

export type JobState = {
  status: JobStatus;
  stage: JobStage | "init";
  updatedAt: string;
  error?: { name: string; message: string };
};

const STATE_FILENAME = "state.json";

export const getJobStatePath = (sessionId: string, jobId: string): string =>
  path.join(getJobDir(sessionId, jobId), STATE_FILENAME);

const DEFAULT_STATE: Omit<JobState, "updatedAt"> = {
  status: "queued",
  stage: "init",
};

export async function readJobState(sessionId: string, jobId: string): Promise<JobState> {
  try {
    const raw = await fs.readFile(getJobStatePath(sessionId, jobId), "utf8");
    return JSON.parse(raw) as JobState;
  } catch {
    return { ...DEFAULT_STATE, updatedAt: new Date().toISOString() };
  }
}

export async function writeJobState(
  sessionId: string,
  jobId: string,
  state: JobState,
): Promise<void> {
  await writeFileAtomic(
    getJobStatePath(sessionId, jobId),
    JSON.stringify(state, null, 2),
  );
}
