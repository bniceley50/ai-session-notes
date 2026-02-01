export type JobStatus = "queued" | "running" | "complete" | "failed";

export type JobRecord = {
  jobId: string;
  practiceId: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
