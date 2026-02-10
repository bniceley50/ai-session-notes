import { readJobStatusById, updateJobStatus } from "./status";
import { runJobPipeline } from "./pipeline";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Process all queued jobs found in the job index
 *
 * This function can be called by:
 * - A cron job hitting /api/jobs/runner
 * - A worker process in a loop
 * - Vercel/Netlify scheduled functions
 *
 * @returns Number of jobs processed
 */
export async function processQueuedJobs(): Promise<number> {
  const jobIndexDir = path.resolve(process.cwd(), ".artifacts/_index/jobs");

  try {
    await fs.access(jobIndexDir);
  } catch {
    // No job index directory yet
    return 0;
  }

  const files = await fs.readdir(jobIndexDir);
  const jobFiles = files.filter(f => f.endsWith(".json"));

  let processed = 0;

  for (const file of jobFiles) {
    const jobId = file.replace(".json", "");

    try {
      const status = await readJobStatusById(jobId);

      // Only process jobs that are queued and haven't started yet
      if (!status || status.status !== "queued") {
        continue;
      }

      // Read job metadata to get artifactId
      const jobMetaPath = path.resolve(jobIndexDir, file);
      const jobMeta = JSON.parse(await fs.readFile(jobMetaPath, "utf8")) as {
        jobId: string;
        sessionId: string;
        createdAt?: string;
      };

      if (!jobMeta.sessionId) {
        continue;
      }

      // Try to find the job.json with artifactId
      const jobDir = path.resolve(
        process.cwd(),
        ".artifacts/sessions",
        jobMeta.sessionId,
        "jobs",
        jobId
      );

      try {
        const jobJsonPath = path.join(jobDir, "job.json");
        const jobJson = JSON.parse(await fs.readFile(jobJsonPath, "utf8")) as {
          jobId: string;
          sessionId: string;
          audioArtifactId?: string;
        };

        if (!jobJson.audioArtifactId) {
          continue;
        }

        // Mark job as running immediately to prevent double-processing
        // (Belt-and-suspenders with lock file)
        await updateJobStatus(jobId, {
          status: "running",
          stage: "transcribe",
          progress: 0,
          errorMessage: null,
        });

        // Process this job (fire-and-forget, pipeline will update status)
        void runJobPipeline({
          sessionId: jobMeta.sessionId,
          jobId,
          artifactId: jobJson.audioArtifactId,
        });

        processed++;
      } catch {
        // Job metadata not found or incomplete
        continue;
      }
    } catch {
      // Failed to process this job, continue to next
      continue;
    }
  }

  return processed;
}
