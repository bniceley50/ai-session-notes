import fs from "node:fs/promises";
import path from "node:path";
import { readAudioMetadata } from "@/lib/jobs/audio";
import { type JobStage, readJobStatusById, updateJobStatus } from "@/lib/jobs/status";
import {
  getJobDir,
  getJobDraftPath,
  getJobExportPath,
  getJobLogPath,
  getJobTranscriptPath,
} from "@/lib/jobs/status";
import { transcribeAudio } from "@/lib/jobs/whisper";
import { generateSOAPNote } from "@/lib/jobs/claude";

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

/**
 * Try to claim a job by creating a lock file
 * Returns true if claim succeeded (this process owns the job)
 * Returns false if job is already claimed by another process
 *
 * This prevents double-execution regardless of who starts the pipeline
 * (create route's setTimeout OR runner's processQueuedJobs)
 */
async function tryClaimJob(sessionId: string, jobId: string): Promise<boolean> {
  const lockPath = path.join(getJobDir(sessionId, jobId), "runner.lock");

  try {
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(lockPath), { recursive: true });

    // Try to create lock file exclusively (wx flag = create only if doesn't exist)
    // This is atomic - only one process will succeed
    await fs.writeFile(
      lockPath,
      JSON.stringify({
        claimedAt: new Date().toISOString(),
        pid: process.pid,
      }),
      { flag: "wx" }
    );

    return true;
  } catch (error) {
    // Lock file already exists - another process claimed this job
    if ((error as { code?: string })?.code === "EEXIST") {
      return false;
    }

    // Other error (permissions, disk full, etc.)
    throw error;
  }
}

const isRealApisEnabled = (): boolean => {
  const flag = process.env.AI_ENABLE_REAL_APIS;
  return flag === "1" || flag === "true";
};

const isStubModeEnabled = (): boolean => {
  const flag = process.env.AI_ENABLE_STUB_APIS;
  return flag === "1" || flag === "true";
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
    // CRITICAL: Claim the job atomically before doing any work
    // This prevents double-execution from both setTimeout (create route) and runner
    const claimed = await tryClaimJob(sessionId, jobId);
    if (!claimed) {
      // Another process already claimed this job - exit silently
      return;
    }

    if (await shouldStop(jobId)) return;
    await appendLog(sessionId, jobId, "pipeline start");

    // Kill switch: require explicit opt-in to real APIs
    if (!isRealApisEnabled() && !isStubModeEnabled()) {
      throw new Error(
        "Real AI APIs are disabled. Set AI_ENABLE_REAL_APIS=1 in your environment to enable Whisper and Claude. " +
        "For UI testing without API calls, set AI_ENABLE_STUB_APIS=1."
      );
    }

    if (isStubModeEnabled() && !isRealApisEnabled()) {
      await appendLog(sessionId, jobId, "STUB MODE: Using demo content (AI_ENABLE_STUB_APIS=1)");
      // Write stub content for UI testing
      const stubTranscript = `STUB Transcript (Demo Mode)\n\nThis is demo content generated because AI_ENABLE_STUB_APIS=1.\nTo use real Whisper API, set AI_ENABLE_REAL_APIS=1.\n\n[Demo conversation would go here]`;
      await writeTextFile(getJobTranscriptPath(sessionId, jobId), stubTranscript);
      progress = 40;
      await updateJobStatus(jobId, { status: "running", stage: "transcribe", progress, errorMessage: null });

      const stubDraft = `# SOAP Note (Demo Mode)\n\nThis is demo content generated because AI_ENABLE_STUB_APIS=1.\nTo use real Claude API, set AI_ENABLE_REAL_APIS=1.\n\n## Subjective\n[Demo content]\n\n## Objective\n[Demo content]\n\n## Assessment\n[Demo content]\n\n## Plan\n[Demo content]`;
      await writeTextFile(getJobDraftPath(sessionId, jobId), stubDraft);
      progress = 80;
      await updateJobStatus(jobId, { status: "running", stage: "draft", progress, errorMessage: null });

      await updateJobStatus(jobId, { status: "complete", stage: "export", progress: 100, errorMessage: null });
      await appendLog(sessionId, jobId, "pipeline complete (stub mode)");
      return;
    }

    const audio = await readAudioMetadata(sessionId, artifactId);
    const audioSummary = audio
      ? `${audio.filename} (${audio.mime}, ${audio.bytes} bytes)`
      : `artifact ${artifactId}`;

    stage = "transcribe";
    progress = 10;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
    await appendLog(sessionId, jobId, `transcribing: ${audioSummary}`);

    // Call Whisper API for real transcription
    const transcription = await transcribeAudio(sessionId, artifactId);
    const transcriptText = `Transcript\n\nSource: ${audioSummary}\nDuration: ${transcription.duration ? `${Math.round(transcription.duration)}s` : "unknown"}\nTranscribed: ${new Date().toISOString()}\n\n---\n\n${transcription.text}\n`;

    await writeTextFile(getJobTranscriptPath(sessionId, jobId), transcriptText);
    await appendLog(sessionId, jobId, `transcription complete: ${transcription.text.length} chars`);

    progress = 40;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    if (await shouldStop(jobId)) return;
    stage = "draft";
    progress = 60;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
    await appendLog(sessionId, jobId, `generating SOAP note from transcript`);

    // Call Claude API to generate SOAP note from transcript
    const soapNote = await generateSOAPNote(transcription.text);
    const draftText = `# SOAP Note (Draft)\n\n${soapNote.text}\n\n---\nGeneratedAt: ${new Date().toISOString()}\nTokens: ${soapNote.tokens ?? "unknown"}\n`;

    await writeTextFile(getJobDraftPath(sessionId, jobId), draftText);
    await appendLog(sessionId, jobId, `SOAP note generated: ${soapNote.tokens ?? 0} tokens`);

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
