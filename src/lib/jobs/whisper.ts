import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { getAudioFilePath, getSessionAudioDir, readAudioMetadata } from "@/lib/jobs/audio";
import { splitAudioIntoChunks, cleanupChunks } from "@/lib/jobs/ffmpeg";
import { stitchTranscripts } from "@/lib/jobs/stitch";
import { withTimeout } from "@/lib/jobs/withTimeout";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Files larger than 24MB are routed through chunked transcription */
export const CHUNK_THRESHOLD = 24 * 1024 * 1024; // 24 MB

const WHISPER_CHUNK_TIMEOUT_MS =
  Number(process.env.AI_WHISPER_CHUNK_TIMEOUT_MS) || 120_000;

export type TranscriptionResult = {
  text: string;
  duration?: number;
};

export type ChunkedProgressCallback = (
  chunkIndex: number,
  totalChunks: number,
) => void | Promise<void>;

/**
 * Transcribe audio file using OpenAI Whisper API
 * @param sessionId - Session ID for file lookup
 * @param artifactId - Audio artifact ID
 * @returns Transcription text
 */
export async function transcribeAudio(
  sessionId: string,
  artifactId: string,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  // Get audio metadata to find the stored filename
  const metadata = await readAudioMetadata(sessionId, artifactId);
  if (!metadata) {
    throw new Error(`Audio metadata not found: ${artifactId}`);
  }

  // Get the actual file path
  const audioPath = getAudioFilePath(sessionId, metadata.storedName);

  // Create a read stream for the audio file
  const audioStream = fs.createReadStream(audioPath);

  try {
    // Call Whisper API — pass signal so timeout can abort the HTTP request
    const response = await openai.audio.transcriptions.create(
      {
        file: audioStream,
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json",
      },
      { signal },
    );

    return {
      text: response.text,
      duration: response.duration,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
    throw new Error("Whisper transcription failed: Unknown error");
  }
}

/**
 * Transcribe a single chunk file via Whisper.
 * Internal helper — not exported.
 */
async function transcribeChunkFile(
  chunkPath: string,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const audioStream = fs.createReadStream(chunkPath);

  const response = await openai.audio.transcriptions.create(
    {
      file: audioStream,
      model: "whisper-1",
      language: "en",
      response_format: "verbose_json",
    },
    { signal },
  );

  return {
    text: response.text,
    duration: response.duration,
  };
}

/**
 * Transcribe a large audio file by splitting it into chunks,
 * transcribing each chunk via Whisper, and stitching the results.
 *
 * @param sessionId   - Session ID for file lookup
 * @param artifactId  - Audio artifact ID
 * @param onProgress  - Called after each chunk completes
 * @param signal      - AbortSignal for cancellation
 */
export async function transcribeAudioChunked(
  sessionId: string,
  artifactId: string,
  onProgress?: ChunkedProgressCallback,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const metadata = await readAudioMetadata(sessionId, artifactId);
  if (!metadata) {
    throw new Error(`Audio metadata not found: ${artifactId}`);
  }

  const audioPath = getAudioFilePath(sessionId, metadata.storedName);
  const chunkDir = path.join(getSessionAudioDir(sessionId), `chunks-${artifactId}`);

  let chunkPaths: string[] = [];

  try {
    // Split audio into chunks using FFmpeg
    chunkPaths = await splitAudioIntoChunks(audioPath, chunkDir);

    const texts: string[] = [];
    let totalDuration = 0;

    for (let i = 0; i < chunkPaths.length; i++) {
      // Check for cancellation before each chunk
      if (signal?.aborted) {
        throw new Error("Transcription cancelled");
      }

      const result = await withTimeout(
        (chunkSignal) => transcribeChunkFile(chunkPaths[i], chunkSignal),
        WHISPER_CHUNK_TIMEOUT_MS,
        `Whisper chunk ${i + 1}/${chunkPaths.length}`,
      );

      texts.push(result.text);
      if (result.duration) totalDuration += result.duration;

      // Report progress
      if (onProgress) {
        await onProgress(i + 1, chunkPaths.length);
      }
    }

    // Stitch transcripts with overlap deduplication
    const combinedText = stitchTranscripts(texts);

    return {
      text: combinedText,
      duration: totalDuration || undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Chunked transcription failed: ${error.message}`);
    }
    throw new Error("Chunked transcription failed: Unknown error");
  } finally {
    // Always clean up chunk files
    await cleanupChunks(chunkPaths, chunkDir);
  }
}
