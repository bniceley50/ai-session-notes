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
  getSessionTranscriptPath,
} from "@/lib/jobs/status";
import { transcribeAudio } from "@/lib/jobs/whisper";
import { generateClinicalNote, type ClinicalNoteType } from "@/lib/jobs/claude";
import { withTimeout } from "@/lib/jobs/withTimeout";

const WHISPER_TIMEOUT_MS = Number(process.env.AI_WHISPER_TIMEOUT_MS) || 120_000;
const CLAUDE_TIMEOUT_MS = Number(process.env.AI_CLAUDE_TIMEOUT_MS) || 90_000;

export type PipelineMode = "transcribe" | "analyze" | "full";

export type PipelineInput = {
  sessionId: string;
  jobId: string;
  artifactId: string;
  mode?: PipelineMode;
  noteType?: ClinicalNoteType;
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
  mode = "full",
  noteType = "soap",
}: PipelineInput): Promise<void> => {
  const runTranscribe = mode === "transcribe" || mode === "full";
  const runAnalyze = mode === "analyze" || mode === "full";

  let stage: JobStage = runTranscribe ? "transcribe" : "draft";
  let progress = 0;

  try {
    const claimed = await tryClaimJob(sessionId, jobId);
    if (!claimed) return;

    if (await shouldStop(jobId)) return;
    await appendLog(sessionId, jobId, `pipeline start (mode=${mode})`);

    if (!isRealApisEnabled() && !isStubModeEnabled()) {
      throw new Error(
        "Real AI APIs are disabled. Set AI_ENABLE_REAL_APIS=1 in your environment to enable Whisper and Claude. " +
        "For UI testing without API calls, set AI_ENABLE_STUB_APIS=1."
      );
    }

    // ── STUB MODE ──────────────────────────────────────────────
    if (isStubModeEnabled() && !isRealApisEnabled()) {
      await appendLog(sessionId, jobId, `STUB MODE (mode=${mode})`);

      if (runTranscribe) {
        const stubTranscript = `STUB Transcript (Demo Mode)\n\nThis is demo content generated because AI_ENABLE_STUB_APIS=1.\nTo use real Whisper API, set AI_ENABLE_REAL_APIS=1.\n\n[Demo conversation would go here]`;
        await writeTextFile(getJobTranscriptPath(sessionId, jobId), stubTranscript);
        // Also write session-level transcript so analyze-only can find it later
        await writeTextFile(getSessionTranscriptPath(sessionId), stubTranscript);
        progress = 40;
        await updateJobStatus(jobId, { status: "running", stage: "transcribe", progress, errorMessage: null });
      }

      if (runAnalyze) {
        const noteLabel = noteType.toUpperCase();
        const stubDraft = `# ${noteLabel} Note (Demo Mode)\n\nThis is demo content generated because AI_ENABLE_STUB_APIS=1.\nTo use real Claude API, set AI_ENABLE_REAL_APIS=1.\n\nNote type: ${noteType}\n\n## Section 1\n[Demo content]\n\n## Section 2\n[Demo content]\n\n## Section 3\n[Demo content]`;
        await writeTextFile(getJobDraftPath(sessionId, jobId), stubDraft);
        progress = 80;
        await updateJobStatus(jobId, { status: "running", stage: "draft", progress, errorMessage: null });
      }

      await updateJobStatus(jobId, { status: "complete", stage: runAnalyze ? "export" : "transcribe", progress: 100, errorMessage: null });
      await appendLog(sessionId, jobId, `pipeline complete (stub, mode=${mode})`);
      return;
    }

    // ── REAL MODE ──────────────────────────────────────────────
    let transcriptText = "";

    if (runTranscribe) {
      const audio = await readAudioMetadata(sessionId, artifactId);
      const audioSummary = audio
        ? `${audio.filename} (${audio.mime}, ${audio.bytes} bytes)`
        : `artifact ${artifactId}`;

      stage = "transcribe";
      progress = 0;
      await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
      await appendLog(sessionId, jobId, `transcribing: ${audioSummary}`);

      // Check right before the expensive Whisper API call
      if (await shouldStop(jobId)) return;

      const transcription = await withTimeout(
        (signal) => transcribeAudio(sessionId, artifactId, signal),
        WHISPER_TIMEOUT_MS,
        "Whisper transcription",
      );

      // Check right after Whisper returns (user may have cancelled while waiting)
      if (await shouldStop(jobId)) return;

      transcriptText = `Transcript\n\nSource: ${audioSummary}\nDuration: ${transcription.duration ? `${Math.round(transcription.duration)}s` : "unknown"}\nTranscribed: ${new Date().toISOString()}\n\n---\n\n${transcription.text}\n`;

      await writeTextFile(getJobTranscriptPath(sessionId, jobId), transcriptText);
      // Write session-level transcript so analyze-only jobs can find it
      await writeTextFile(getSessionTranscriptPath(sessionId), transcriptText);
      await appendLog(sessionId, jobId, `transcription complete: ${transcription.text.length} chars`);

      progress = 40;
      await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
    }

    // If transcribe-only, we're done
    if (!runAnalyze) {
      await updateJobStatus(jobId, { status: "complete", stage: "transcribe", progress: 100, errorMessage: null });
      await appendLog(sessionId, jobId, "pipeline complete (transcribe-only)");
      return;
    }

    if (await shouldStop(jobId)) return;

    // For analyze-only, load transcript from session-level file
    if (!transcriptText) {
      try {
        transcriptText = await fs.readFile(getSessionTranscriptPath(sessionId), "utf8");
      } catch {
        throw new Error("No transcript found. Please upload and transcribe audio first.");
      }
    }

    stage = "draft";
    progress = runTranscribe ? 40 : 0;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
    await appendLog(sessionId, jobId, `generating ${noteType} note from transcript`);

    // Check right before the expensive Claude API call
    if (await shouldStop(jobId)) return;

    const clinicalNote = await withTimeout(
      (signal) => generateClinicalNote(transcriptText, noteType, signal),
      CLAUDE_TIMEOUT_MS,
      "Claude note generation",
    );

    // Check right after Claude returns (user may have cancelled while waiting)
    if (await shouldStop(jobId)) return;

    const noteLabel = noteType.toUpperCase();
    const draftText = `# ${noteLabel} Note (Draft)\n\n${clinicalNote.text}\n\n---\nGeneratedAt: ${new Date().toISOString()}\nTokens: ${clinicalNote.tokens ?? "unknown"}\n`;

    await writeTextFile(getJobDraftPath(sessionId, jobId), draftText);
    await appendLog(sessionId, jobId, `${noteType} note generated: ${clinicalNote.tokens ?? 0} tokens`);

    progress = 80;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    if (await shouldStop(jobId)) return;
    stage = "export";
    progress = 90;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    const exportText = `EHR Export\n\nGenerated: ${new Date().toISOString()}\n`;
    await writeTextFile(getJobExportPath(sessionId, jobId), exportText);

    await updateJobStatus(jobId, { status: "complete", stage: "export", progress: 100, errorMessage: null });
    await appendLog(sessionId, jobId, "pipeline complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed.";
    await updateJobStatus(jobId, { status: "failed", stage, progress, errorMessage: message }).catch(() => {});
    await appendLog(sessionId, jobId, `pipeline failed: ${message}`).catch(() => {});
  }
};
