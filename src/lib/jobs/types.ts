export type JobStatus =
  | "queued"
  | "uploaded"
  | "transcribed"
  | "drafted"
  | "exported"
  | "complete"
  | "failed";

export type JobStatusEvent = {
  status: JobStatus;
  at: string;
  progress: number;
};

export type JobRecord = {
  jobId: string;
  practiceId: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  statusHistory: JobStatusEvent[];
  expiresAt: string;
};
