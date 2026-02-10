// tests/helpers.ts
// Shared test utilities. Keep this small — it should not become a framework.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSessionCookie, type SessionInput } from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Temp artifacts directory
// ---------------------------------------------------------------------------

/**
 * Creates a temp directory, sets ARTIFACTS_ROOT to it, runs `fn`, then cleans up.
 *
 * IMPORTANT: ARTIFACTS_ROOT is a module-level constant read at import time.
 * Because we set the env var in setup-env.ts *before* any imports, and artifacts.ts
 * reads `process.env.ARTIFACTS_ROOT || ".artifacts"`, this works as long as the
 * module is first imported AFTER setup-env runs (which --import guarantees).
 *
 * However, because the constant is captured once, all tests in a single file share
 * the same ARTIFACTS_ROOT value. For per-test isolation we create subdirectories.
 */
export async function withTempArtifacts<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "asn-test-"));
  const prev = process.env.ARTIFACTS_ROOT;
  process.env.ARTIFACTS_ROOT = root;
  try {
    return await fn(root);
  } finally {
    process.env.ARTIFACTS_ROOT = prev;
    await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Seed session ownership
// ---------------------------------------------------------------------------

export async function seedSessionOwnership(
  root: string,
  sessionId: string,
  ownerUserId: string,
): Promise<void> {
  const dir = path.join(root, "_index", "sessions");
  await fs.mkdir(dir, { recursive: true });
  const payload = {
    sessionId,
    ownerUserId,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, `${sessionId}.json`), JSON.stringify(payload, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Seed job index + status
// ---------------------------------------------------------------------------

export async function seedJobIndex(
  root: string,
  jobId: string,
  sessionId: string,
): Promise<void> {
  const dir = path.join(root, "_index", "jobs");
  await fs.mkdir(dir, { recursive: true });
  const payload = { jobId, sessionId, createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(dir, `${jobId}.json`), JSON.stringify(payload, null, 2), "utf8");
}

export async function seedJobStatus(
  root: string,
  sessionId: string,
  jobId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const jobDir = path.join(root, "sessions", sessionId, "jobs", jobId);
  await fs.mkdir(jobDir, { recursive: true });
  const status = {
    jobId,
    sessionId,
    status: "queued",
    stage: "transcribe",
    progress: 0,
    updatedAt: new Date().toISOString(),
    errorMessage: null,
    ...overrides,
  };
  await fs.writeFile(path.join(jobDir, "status.json"), JSON.stringify(status, null, 2), "utf8");
}

export async function seedAudioMetadata(
  root: string,
  sessionId: string,
  artifactId: string,
): Promise<void> {
  const dir = path.join(root, sessionId, "audio");
  await fs.mkdir(dir, { recursive: true });
  const meta = {
    artifactId,
    sessionId,
    filename: "recording.webm",
    storedName: `${artifactId}.webm`,
    mime: "audio/webm",
    bytes: 1024,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, `${artifactId}.json`), JSON.stringify(meta, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Auth cookie helper
// ---------------------------------------------------------------------------

const DEFAULT_SESSION: SessionInput = {
  sub: "user-alice",
  email: "alice@example.com",
  practiceId: "practice-test",
  role: "clinician",
};

export async function makeAuthCookie(overrides: Partial<SessionInput> = {}): Promise<string> {
  const session: SessionInput = { ...DEFAULT_SESSION, ...overrides };
  const setCookie = await createSessionCookie(session);
  // createSessionCookie returns a full Set-Cookie header string like:
  //   asn_session=<token>; Max-Age=3600; Path=/; SameSite=lax; HttpOnly
  // We need just the "asn_session=<token>" portion for a Cookie request header.
  const nameValue = setCookie.split(";")[0];
  return nameValue;
}

export async function makeAuthHeaders(overrides: Partial<SessionInput> = {}): Promise<Headers> {
  const cookie = await makeAuthCookie(overrides);
  return new Headers({ cookie });
}
