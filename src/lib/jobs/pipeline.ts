import fs from "node:fs/promises";
import path from "node:path";
import { readAudioMetadata } from "@/lib/jobs/audio";
import { type JobStage, readJobStatusById, updateJobStatus } from "@/lib/jobs/status";
import {
  getJobDraftPath,
  getJobExportPath,
  getJobLogPath,
  getJobTranscriptPath,
} from "@/lib/jobs/status";

export type PipelineInput = {
  sessionId: string;
  jobId: string;
  artifactId: string;
};

const appendLog = async (sessionId: string, jobId: string, message: string): Promise<void> => {
  const logPath = getJobLogPath(sessionId, jobId);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await fs.appendFile(logPath, line, "utf8");
};

const writeTextFile = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
};

const shouldStop = async (jobId: string): Promise<boolean> => {
  const status = await readJobStatusById(jobId);
  if (!status) return true;
  return status.status === "deleted";
};

export const runJobPipeline = async ({
  sessionId,
  jobId,
  artifactId,
}: PipelineInput): Promise<void> => {
  // NOTE: Fire-and-forget execution is best-effort in serverless environments.
  // We'll move this to a worker/queue later for durability.
  let stage: JobStage = "transcribe";
  let progress = 0;

  try {
    if (await shouldStop(jobId)) return;
    await appendLog(sessionId, jobId, "pipeline start");

    const audio = await readAudioMetadata(sessionId, artifactId);
    const audioSummary = audio
      ? `${audio.filename} (${audio.mime}, ${audio.bytes} bytes)`
      : `artifact ${artifactId}`;

    stage = "transcribe";
    progress = 10;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    const transcriptText = `Transcript (placeholder)\n\nSource: ${audioSummary}\nGeneratedAt: ${new Date().toISOString()}\n`;
    await writeTextFile(getJobTranscriptPath(sessionId, jobId), transcriptText);
    progress = 40;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    if (await shouldStop(jobId)) return;
    stage = "draft";
    progress = 60;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    const draftText = `# SOAP Note (Draft)\n\n## Subjective\nPatient encounter recorded.\n\n## Objective\nNo vitals captured.\n\n## Assessment\nNeeds clinician review.\n\n## Plan\nFollow up as indicated.\n\n---\nGeneratedAt: ${new Date().toISOString()}\n`;
    await writeTextFile(getJobDraftPath(sessionId, jobId), draftText);
    progress = 80;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    if (await shouldStop(jobId)) return;
    stage = "export";
    progress = 90;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    const exportText = `EHR Export\n\nSummary: Placeholder export for ${audioSummary}\nGeneratedAt: ${new Date().toISOString()}\n`;
    await writeTextFile(getJobExportPath(sessionId, jobId), exportText);
    progress = 100;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    await updateJobStatus(jobId, {
      status: "complete",
      stage: "export",
      progress: 100,
      errorMessage: null,
    });
    await appendLog(sessionId, jobId, "pipeline complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed.";
    await updateJobStatus(jobId, {
      status: "failed",
      stage,
      progress,
      errorMessage: message,
    }).catch(() => {});
    await appendLog(sessionId, jobId, `pipeline failed: ${message}`).catch(() => {});
  }
};
