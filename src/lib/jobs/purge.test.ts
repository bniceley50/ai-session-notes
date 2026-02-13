import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import { purgeExpiredJobArtifacts } from "./purge";

const indexDir = path.resolve(ARTIFACTS_ROOT, "_index", "jobs");
const sessionsDir = path.resolve(ARTIFACTS_ROOT, "sessions");

async function seedJob(jobId: string, sessionId: string, createdAt: string): Promise<void> {
  await fs.mkdir(indexDir, { recursive: true });
  await fs.writeFile(
    path.join(indexDir, `${jobId}.json`),
    JSON.stringify({ jobId, sessionId, createdAt }, null, 2),
    "utf8",
  );

  const jobDir = path.join(sessionsDir, sessionId, "jobs", jobId);
  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(path.join(jobDir, "status.json"), "{}", "utf8");
}

test("purges expired job index + job folder", async () => {
  const sessionId = `sess-expired-${Date.now()}`;
  const jobId = `job-expired-${Date.now()}`;
  const old = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  await seedJob(jobId, sessionId, old);

  const result = await purgeExpiredJobArtifacts();
  assert.equal(result.purgedJobs, 1);

  await assert.rejects(fs.access(path.join(indexDir, `${jobId}.json`)));
  await assert.rejects(fs.access(path.join(sessionsDir, sessionId, "jobs", jobId)));
});

test("deletes full session directory when last job expires", async () => {
  const sessionId = `sess-last-${Date.now()}`;
  const jobId = `job-last-${Date.now()}`;
  const old = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  await seedJob(jobId, sessionId, old);
  await fs.writeFile(path.join(sessionsDir, sessionId, "audio.bin"), "x", "utf8");

  const result = await purgeExpiredJobArtifacts();
  assert.equal(result.purgedSessions, 1);
  await assert.rejects(fs.access(path.join(sessionsDir, sessionId)));
});

test("keeps session directory when non-expired jobs remain", async () => {
  const sessionId = `sess-mixed-${Date.now()}`;
  const oldJobId = `job-old-${Date.now()}`;
  const newJobId = `job-new-${Date.now()}`;
  const old = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  const fresh = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await seedJob(oldJobId, sessionId, old);
  await seedJob(newJobId, sessionId, fresh);

  const result = await purgeExpiredJobArtifacts();
  assert.equal(result.purgedJobs, 1);
  assert.equal(result.purgedSessions, 0);

  await fs.access(path.join(sessionsDir, sessionId));
  await fs.access(path.join(indexDir, `${newJobId}.json`));
});

test("cleans stale session.lock files during purge", async () => {
  const sessionId = `sess-stalelock-${Date.now()}`;
  const sessionDir = path.join(sessionsDir, sessionId);
  const lockPath = path.join(sessionDir, "session.lock");

  // Create a session dir with a stale lock file
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(lockPath, '{"lockedAt":"old","pid":1}', "utf8");

  // Set the lock file mtime to 10 minutes ago (well past 5-minute threshold)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  await fs.utimes(lockPath, tenMinAgo, tenMinAgo);

  await purgeExpiredJobArtifacts();

  // Lock file should have been cleaned up
  await assert.rejects(fs.access(lockPath), "stale lock should be removed");

  // Clean up session dir
  await fs.rm(sessionDir, { recursive: true, force: true });
});

test("keeps fresh session.lock files during purge", async () => {
  const sessionId = `sess-freshlock-${Date.now()}`;
  const sessionDir = path.join(sessionsDir, sessionId);
  const lockPath = path.join(sessionDir, "session.lock");

  // Create a session dir with a fresh lock file (just created = mtime is now)
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(lockPath, '{"lockedAt":"now","pid":1}', "utf8");

  await purgeExpiredJobArtifacts();

  // Fresh lock file should NOT be removed
  await fs.access(lockPath); // should not throw

  // Clean up
  await fs.rm(sessionDir, { recursive: true, force: true });
});

