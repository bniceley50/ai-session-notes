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
import { transcribeAudio, transcribeAudioChunked, CHUNK_THRESHOLD } from "@/lib/jobs/whisper";
import { generateClinicalNote, type ClinicalNoteType } from "@/lib/jobs/claude";
import { withTimeout } from "@/lib/jobs/withTimeout";
import { checkFfmpeg } from "@/lib/jobs/ffmpeg";
import { writeFileAtomic } from "@/lib/fs/writeFileAtomic";
import { writeJobState } from "@/lib/jobs/jobState";
import {
  aiWhisperTimeoutMs,
  aiClaudeTimeoutMs,
  aiRealApisEnabled,
  aiStubApisEnabled,
} from "@/lib/config";

const WHISPER_TIMEOUT_MS = aiWhisperTimeoutMs();
const CLAUDE_TIMEOUT_MS = aiClaudeTimeoutMs();

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
  await writeFileAtomic(filePath, content);
};

const shouldStop = async (jobId: string): Promise<boolean> => {
  const status = await readJobStatusById(jobId);
  if (!status) return true;
  return status.status === "deleted";
};

/**
 * Check if a file exists and is non-empty.
 * Used for idempotent stage skipping: if the final output already exists,
 * the stage can be safely skipped on re-run.
 */
const outputExists = async (filePath: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
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

const isRealApisEnabled = (): boolean => aiRealApisEnabled();

const isStubModeEnabled = (): boolean => aiStubApisEnabled();

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

  let claimed = false;
  try {
    claimed = await tryClaimJob(sessionId, jobId);
    if (!claimed) return;

    if (await shouldStop(jobId)) return;
    await writeJobState(sessionId, jobId, { status: "running", stage: "init", updatedAt: new Date().toISOString() });
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
        stage = "transcribe";
        await writeJobState(sessionId, jobId, { status: "running", stage, updatedAt: new Date().toISOString() });

        const jobTranscriptExists = await outputExists(getJobTranscriptPath(sessionId, jobId));
        const sessionTranscriptExists = await outputExists(getSessionTranscriptPath(sessionId));

        if (jobTranscriptExists && sessionTranscriptExists) {
          await appendLog(sessionId, jobId, "transcribe skipped (outputs exist)");
        } else {
          const stubTranscript = `STUB Transcript (Demo Mode)\n\nThis is demo content generated because AI_ENABLE_STUB_APIS=1.\nTo use real Whisper API, set AI_ENABLE_REAL_APIS=1.\n\n[Demo conversation would go here]`;
          await writeTextFile(getJobTranscriptPath(sessionId, jobId), stubTranscript);
          await writeTextFile(getSessionTranscriptPath(sessionId), stubTranscript);
        }
        progress = 40;
        await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
      }

      if (runAnalyze) {
        stage = "draft";
        await writeJobState(sessionId, jobId, { status: "running", stage, updatedAt: new Date().toISOString() });

        if (await outputExists(getJobDraftPath(sessionId, jobId))) {
          await appendLog(sessionId, jobId, "draft skipped (output exists)");
        } else {
          const noteLabel = noteType.toUpperCase();
          const stubDraft = `# ${noteLabel} Note (Demo Mode)\n\nThis is demo content generated because AI_ENABLE_STUB_APIS=1.\nTo use real Claude API, set AI_ENABLE_REAL_APIS=1.\n\nNote type: ${noteType}\n\n## Section 1\n[Demo content]\n\n## Section 2\n[Demo content]\n\n## Section 3\n[Demo content]`;
          await writeTextFile(getJobDraftPath(sessionId, jobId), stubDraft);
        }
        progress = 80;
        await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
      }

      const finalStage = runAnalyze ? "export" : "transcribe";
      await writeJobState(sessionId, jobId, { status: "complete", stage: finalStage, updatedAt: new Date().toISOString() });
      await updateJobStatus(jobId, { status: "complete", stage: finalStage, progress: 100, errorMessage: null });
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
      await writeJobState(sessionId, jobId, { status: "running", stage, updatedAt: new Date().toISOString() });
      await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

      const jobTranscriptExists = await outputExists(getJobTranscriptPath(sessionId, jobId));
      const sessionTranscriptExists = await outputExists(getSessionTranscriptPath(sessionId));

      if (jobTranscriptExists && sessionTranscriptExists) {
        await appendLog(sessionId, jobId, `transcribe skipped (outputs exist): ${audioSummary}`);
        // Load existing transcript so draft stage can use it
        transcriptText = await fs.readFile(getJobTranscriptPath(sessionId, jobId), "utf8");
      } else {
        await appendLog(sessionId, jobId, `transcribing: ${audioSummary}`);

        // Check right before the expensive Whisper API call
        if (await shouldStop(jobId)) return;

        // Route based on file size: chunked for large files, direct for small
        let transcription: { text: string; duration?: number };

        if (audio && audio.bytes > CHUNK_THRESHOLD) {
          // Large file — verify FFmpeg is available
          const ffmpegOk = await checkFfmpeg();
          if (!ffmpegOk) {
            throw new Error(
              `Audio file is ${Math.round(audio.bytes / 1024 / 1024)}MB (over ${Math.round(CHUNK_THRESHOLD / 1024 / 1024)}MB limit). ` +
              "FFmpeg is required for chunked transcription but was not found on PATH.",
            );
          }

          await appendLog(sessionId, jobId, `large file (${Math.round(audio.bytes / 1024 / 1024)}MB) — using chunked transcription`);

          transcription = await transcribeAudioChunked(
            sessionId,
            artifactId,
            async (chunkIndex, totalChunks) => {
              // Distribute progress across 0–40% range
              const chunkProgress = Math.floor((chunkIndex / totalChunks) * 40);
              await updateJobStatus(jobId, { status: "running", stage, progress: chunkProgress, errorMessage: null });
              await appendLog(sessionId, jobId, `chunk ${chunkIndex}/${totalChunks} transcribed`);

              // Check for cancellation between chunks
              if (await shouldStop(jobId)) {
                throw new Error("Job cancelled during chunked transcription");
              }
            },
          );
        } else {
          // Small file — direct Whisper API call
          transcription = await withTimeout(
            (signal) => transcribeAudio(sessionId, artifactId, signal),
            WHISPER_TIMEOUT_MS,
            "Whisper transcription",
          );
        }

        // Check right after Whisper returns (user may have cancelled while waiting)
        if (await shouldStop(jobId)) return;

        transcriptText = `Transcript\n\nSource: ${audioSummary}\nDuration: ${transcription.duration ? `${Math.round(transcription.duration)}s` : "unknown"}\nTranscribed: ${new Date().toISOString()}\n\n---\n\n${transcription.text}\n`;

        await writeTextFile(getJobTranscriptPath(sessionId, jobId), transcriptText);
        // Write session-level transcript so analyze-only jobs can find it
        await writeTextFile(getSessionTranscriptPath(sessionId), transcriptText);
        await appendLog(sessionId, jobId, `transcription complete: ${transcription.text.length} chars`);
      }

      progress = 40;
      await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });
    }

    // If transcribe-only, we're done
    if (!runAnalyze) {
      await writeJobState(sessionId, jobId, { status: "complete", stage: "transcribe", updatedAt: new Date().toISOString() });
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
    await writeJobState(sessionId, jobId, { status: "running", stage, updatedAt: new Date().toISOString() });
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    if (await outputExists(getJobDraftPath(sessionId, jobId))) {
      await appendLog(sessionId, jobId, "draft skipped (output exists)");
    } else {
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
    }

    progress = 80;
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    if (await shouldStop(jobId)) return;
    stage = "export";
    progress = 90;
    await writeJobState(sessionId, jobId, { status: "running", stage, updatedAt: new Date().toISOString() });
    await updateJobStatus(jobId, { status: "running", stage, progress, errorMessage: null });

    if (await outputExists(getJobExportPath(sessionId, jobId))) {
      await appendLog(sessionId, jobId, "export skipped (output exists)");
    } else {
      const exportText = `EHR Export\n\nGenerated: ${new Date().toISOString()}\n`;
      await writeTextFile(getJobExportPath(sessionId, jobId), exportText);
    }

    await writeJobState(sessionId, jobId, { status: "complete", stage: "export", updatedAt: new Date().toISOString() });
    await updateJobStatus(jobId, { status: "complete", stage: "export", progress: 100, errorMessage: null });
    await appendLog(sessionId, jobId, "pipeline complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed.";
    const errorName = error instanceof Error ? error.name : "Error";
    await writeJobState(sessionId, jobId, {
      status: "failed",
      stage,
      updatedAt: new Date().toISOString(),
      error: { name: errorName, message },
    }).catch(() => {});
    await updateJobStatus(jobId, { status: "failed", stage, progress, errorMessage: message }).catch(() => {});
    await appendLog(sessionId, jobId, `pipeline failed: ${message}`).catch(() => {});
  } finally {
    if (claimed) {
      const lockPath = path.join(getJobDir(sessionId, jobId), "runner.lock");
      await fs.rm(lockPath, { force: true }).catch(() => {});
    }
  }
};
