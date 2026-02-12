// Route handler integration tests for POST /api/jobs/[jobId]/upload
//
// Auth chain: requireJobOwner (cookie → JWT → jobIndex → sessionOwnership → userId).
// Data sources: filesystem (ownership chain) + in-memory store (job record).
//
// Upload requires BOTH filesystem ownership AND an in-memory job record.
// After process restart, the in-memory store is empty → 404.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { POST } from "@/app/api/jobs/[jobId]/upload/route";
import { writeJobIndex } from "@/lib/jobs/status";
import { writeSessionOwnership } from "@/lib/sessions/ownership";
import { createJob } from "@/lib/jobs/store";
import { makeAuthCookie } from "../../../../../../tests/helpers";

// Helper to build a multipart upload Request + RouteContext
function makeUploadRequest(
  jobId: string,
  options: {
    cookie?: string;
    file?: File;
    sessionId?: string;
  } = {},
) {
  const form = new FormData();
  if (options.sessionId) form.append("sessionId", options.sessionId);
  if (options.file) form.append("file", options.file);

  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;

  const request = new Request(`http://localhost/api/jobs/${jobId}/upload`, {
    method: "POST",
    headers,
    body: form,
  });

  // NextRequest compatibility: cast as needed
  const context = { params: Promise.resolve({ jobId }) };
  return { request, context };
}

function makeDummyFile(name = "recording.webm", bytes = 1024): File {
  const buf = new Uint8Array(bytes);
  return new File([buf], name, { type: "audio/webm" });
}

describe("POST /api/jobs/[jobId]/upload", () => {
  // ---------------------------------------------------------------------------
  // Auth rejection
  // ---------------------------------------------------------------------------

  test("no cookie → 401", async () => {
    const file = makeDummyFile();
    const { request, context } = makeUploadRequest("job-1", { file });
    const response = await POST(request as any, context);
    assert.equal(response.status, 401);

    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "UNAUTHENTICATED");
  });

  test("garbage cookie → 401", async () => {
    const file = makeDummyFile();
    const { request, context } = makeUploadRequest("job-1", {
      cookie: "asn_session=garbage",
      file,
    });
    const response = await POST(request as any, context);
    assert.equal(response.status, 401);
  });

  // ---------------------------------------------------------------------------
  // Ownership enforcement
  // ---------------------------------------------------------------------------

  test("authenticated non-owner → 404", async () => {
    const jobId = `job-upload-bob-${Date.now()}`;
    const sessionId = `sess-upload-bob-${Date.now()}`;

    await writeSessionOwnership(sessionId, "user-bob");
    await writeJobIndex(jobId, sessionId);

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const file = makeDummyFile();
    const { request, context } = makeUploadRequest(jobId, { cookie, file, sessionId });
    const response = await POST(request as any, context);
    assert.equal(response.status, 404);
  });

  test("job not in filesystem index → 404", async () => {
    const cookie = await makeAuthCookie();
    const file = makeDummyFile();
    const { request, context } = makeUploadRequest("nonexistent-job", { cookie, file });
    const response = await POST(request as any, context);
    assert.equal(response.status, 404);
  });

  // ---------------------------------------------------------------------------
  // Input validation
  // ---------------------------------------------------------------------------

  test("no file in form → 400", async () => {
    const jobId = `job-upload-nofile-${Date.now()}`;
    const sessionId = `sess-upload-nofile-${Date.now()}`;

    await writeSessionOwnership(sessionId, "user-alice");
    await writeJobIndex(jobId, sessionId);
    createJob("practice-test", sessionId, jobId);

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    // Request without file
    const { request, context } = makeUploadRequest(jobId, { cookie, sessionId });
    const response = await POST(request as any, context);
    assert.equal(response.status, 400);
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  test("owner + valid file → 200", async () => {
    const jobId = `job-upload-ok-${Date.now()}`;
    const sessionId = `sess-upload-ok-${Date.now()}`;
    const practiceId = "practice-test";

    // Seed filesystem ownership chain
    await writeSessionOwnership(sessionId, "user-alice");
    await writeJobIndex(jobId, sessionId);

    // Seed in-memory store — createJob(practiceId, sessionId, jobId)
    createJob(practiceId, sessionId, jobId);

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId });
    const file = makeDummyFile("test-audio.webm", 2048);
    const { request, context } = makeUploadRequest(jobId, { cookie, file, sessionId });
    const response = await POST(request as any, context);
    assert.equal(response.status, 200);

    const body = (await response.json()) as { jobId?: string; upload?: { storedName?: string } };
    assert.equal(body.jobId, jobId);
    assert.ok(body.upload?.storedName, "response must include upload.storedName");
  });

  test("owner but job NOT in in-memory store → 404 (process restart scenario)", async () => {
    const jobId = `job-upload-restart-${Date.now()}`;
    const sessionId = `sess-upload-restart-${Date.now()}`;

    await writeSessionOwnership(sessionId, "user-alice");
    await writeJobIndex(jobId, sessionId);
    // Deliberately NOT seeding the in-memory store

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const file = makeDummyFile();
    const { request, context } = makeUploadRequest(jobId, { cookie, file, sessionId });
    const response = await POST(request as any, context);
    assert.equal(response.status, 404);
  });

  // ---------------------------------------------------------------------------
  // Path safety: filename sanitization
  // ---------------------------------------------------------------------------

  test("path-traversal filename is sanitized", async () => {
    const jobId = `job-upload-safe-${Date.now()}`;
    const sessionId = `sess-upload-safe-${Date.now()}`;
    const practiceId = "practice-test";

    await writeSessionOwnership(sessionId, "user-alice");
    await writeJobIndex(jobId, sessionId);
    createJob(practiceId, sessionId, jobId);

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId });
    // Malicious filename with path traversal
    const file = makeDummyFile("../../etc/passwd", 512);
    const { request, context } = makeUploadRequest(jobId, { cookie, file, sessionId });
    const response = await POST(request as any, context);
    // Should succeed — safeFilename strips traversal characters
    assert.equal(response.status, 200);

    const body = (await response.json()) as { upload?: { storedName?: string } };
    // The stored name should NOT contain path separators
    assert.ok(body.upload?.storedName, "storedName must exist");
    assert.ok(
      !body.upload!.storedName!.includes(".."),
      "storedName must not contain path traversal",
    );
    assert.ok(
      !body.upload!.storedName!.includes("/"),
      "storedName must not contain forward slash",
    );
  });
});
