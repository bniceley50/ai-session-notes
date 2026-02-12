/**
 * FFmpeg audio splitting utilities.
 *
 * Splits a large audio file into smaller chunks using system FFmpeg.
 * Uses `-c copy` (stream copy) for near-instant splitting without
 * re-encoding, preserving original audio quality.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Default chunk duration in minutes */
export const DEFAULT_CHUNK_MINUTES = 10;

/** Default overlap between chunks in seconds */
export const DEFAULT_OVERLAP_SECONDS = 10;

/**
 * Check whether FFmpeg is available on the system PATH.
 */
export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the duration of an audio file in seconds via ffprobe.
 * Returns null if ffprobe is unavailable or the file can't be probed.
 */
export async function getAudioDuration(inputPath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ],
      { timeout: 10_000 },
    );
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}

/**
 * Calculate chunk boundaries (start/end times) for splitting.
 *
 * @param totalSeconds   - Total audio duration in seconds
 * @param chunkMinutes   - Desired chunk length in minutes
 * @param overlapSeconds - Overlap between consecutive chunks in seconds
 * @returns Array of `{ start, duration }` in seconds
 */
export function calculateChunkBoundaries(
  totalSeconds: number,
  chunkMinutes: number = DEFAULT_CHUNK_MINUTES,
  overlapSeconds: number = DEFAULT_OVERLAP_SECONDS,
): Array<{ start: number; duration: number }> {
  if (totalSeconds <= 0) return [];

  const chunkSeconds = chunkMinutes * 60;
  const step = chunkSeconds - overlapSeconds; // how far to advance each chunk
  const boundaries: Array<{ start: number; duration: number }> = [];

  if (step <= 0) {
    // Overlap >= chunk size — just return the whole file
    return [{ start: 0, duration: totalSeconds }];
  }

  // If the audio fits in a single chunk, no splitting needed
  if (totalSeconds <= chunkSeconds) {
    return [{ start: 0, duration: totalSeconds }];
  }

  for (let start = 0; start < totalSeconds; start += step) {
    const duration = Math.min(chunkSeconds, totalSeconds - start);
    // Skip tiny trailing chunks (< 1 second)
    if (duration < 1 && boundaries.length > 0) break;
    boundaries.push({ start, duration });
  }

  return boundaries;
}

/**
 * Split an audio file into chunks using FFmpeg.
 *
 * @param inputPath       - Absolute path to the source audio file
 * @param outputDir       - Directory to write chunk files into
 * @param chunkMinutes    - Duration of each chunk in minutes
 * @param overlapSeconds  - Overlap between consecutive chunks in seconds
 * @returns Ordered array of absolute paths to the chunk files
 */
export async function splitAudioIntoChunks(
  inputPath: string,
  outputDir: string,
  chunkMinutes: number = DEFAULT_CHUNK_MINUTES,
  overlapSeconds: number = DEFAULT_OVERLAP_SECONDS,
): Promise<string[]> {
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Get duration
  const totalSeconds = await getAudioDuration(inputPath);
  if (totalSeconds === null || totalSeconds <= 0) {
    throw new Error("Could not determine audio duration. Is FFmpeg/ffprobe installed?");
  }

  const boundaries = calculateChunkBoundaries(totalSeconds, chunkMinutes, overlapSeconds);

  if (boundaries.length <= 1) {
    // No splitting needed — return original file path
    return [inputPath];
  }

  // Determine output extension from input
  const ext = path.extname(inputPath) || ".webm";

  const chunkPaths: string[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const { start, duration } = boundaries[i];
    const chunkPath = path.join(outputDir, `chunk-${String(i).padStart(3, "0")}${ext}`);

    await execFileAsync(
      "ffmpeg",
      [
        "-y",                // overwrite if exists
        "-ss", String(start),
        "-t", String(duration),
        "-i", inputPath,
        "-c", "copy",        // stream copy — no re-encoding
        "-avoid_negative_ts", "make_zero",
        chunkPath,
      ],
      { timeout: 60_000 },   // 60s timeout per chunk (copy is fast)
    );

    chunkPaths.push(chunkPath);
  }

  return chunkPaths;
}

/**
 * Remove chunk files created during splitting.
 * Silently ignores missing files.
 */
export async function cleanupChunks(chunkPaths: string[], outputDir?: string): Promise<void> {
  for (const p of chunkPaths) {
    try {
      await fs.unlink(p);
    } catch {
      // ignore — file may already be gone
    }
  }

  // Try to remove the output directory if empty
  if (outputDir) {
    try {
      await fs.rmdir(outputDir);
    } catch {
      // ignore — directory may not be empty or already gone
    }
  }
}
