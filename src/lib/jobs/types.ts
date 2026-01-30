export type JobStatus =
  | "created"
  | "uploaded"
  | "transcribed"
  | "drafted"
  | "exported"
  | "deleted";

export type JobRecord = {
  id: string;
  practiceId: string;
  status: JobStatus;
  createdAt: string;
  expiresAt: string;
};