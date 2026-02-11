import fs from "node:fs/promises";

import { getJobDir, getJobIndexPath } from "@/lib/jobs/status";

/**
 * Remove all filesystem artifacts for a job (best-effort).
 *
 * Deletes:
 *   - Job directory: .artifacts/sessions/{sessionId}/jobs/{jobId}/
 *     (status.json, runner.lock, transcript/, draft/, export/, logs/)
 *   - Job index file: .artifacts/_index/jobs/{jobId}.json
 *
 * Does NOT delete audio artifacts — those live at the session level
 * and may be shared across multiple jobs for the same session.
 */
export async function cleanupJobArtifacts(
  sessionId: string,
  jobId: string,
): Promise<void> {
  // Remove job directory (recursive)
  try {
    const jobDir = getJobDir(sessionId, jobId);
    await fs.rm(jobDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`[cleanup] failed to remove job dir for ${jobId}:`, error);
  }

  // Remove job index file
  try {
    const indexPath = getJobIndexPath(jobId);
    await fs.rm(indexPath, { force: true });
  } catch (error) {
    console.error(`[cleanup] failed to remove job index for ${jobId}:`, error);
  }
}
