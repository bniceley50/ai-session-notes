// Route handler integration tests for POST /api/sessions/[sessionId]/audio
//
// Tests the audio upload endpoint directly by calling the route handler function.
// Uses stub auth and filesystem-backed session ownership.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import { POST } from "@/app/api/sessions/[sessionId]/audio/route";
import { makeAuthCookie } from "../../../../../../tests/helpers";
import { writeSessionOwnership } from "@/lib/sessions/ownership";

const artifactsRoot = path.resolve(ARTIFACTS_ROOT);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake audio body (just some bytes — not real audio) */
function fakeAudioBody(byteLength = 256): Uint8Array {
  return new Uint8Array(byteLength).fill(0xab);
}

/** Build a Request + RouteContext pair for the audio upload endpoint */
async function buildUploadRequest(opts: {
  sessionId: string;
  filename?: string;
  contentType?: string;
  body?: BodyInit | null;
  authenticated?: boolean;
}) {
  const {
    sessionId,
    filename = "recording.webm",
    contentType = "audio/webm",
    body = fakeAudioBody(),
    authenticated = true,
  } = opts;

  const url = `http://localhost:3000/api/sessions/${encodeURIComponent(sessionId)}/audio?filename=${encodeURIComponent(filename)}`;

  const headers: Record<string, string> = {};
  if (contentType) headers["content-type"] = contentType;
  if (authenticated) {
    headers["cookie"] = await makeAuthCookie();
  }

  const request = new Request(url, {
    method: "POST",
    headers,
    body,
  });

  const context = { params: Promise.resolve({ sessionId }) };

  return { request, context };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/sessions/[sessionId]/audio", () => {
  test("no auth cookie → 401", async () => {
    const { request, context } = await buildUploadRequest({
      sessionId: "sess-audio-1",
      authenticated: false,
    });
    const res = await POST(request, context);
    assert.equal(res.status, 401);
  });

  test("unsupported content-type → 415", async () => {
    const sessionId = "sess-audio-415";
    await writeSessionOwnership(sessionId, "user-alice");

    const { request, context } = await buildUploadRequest({
      sessionId,
      contentType: "text/plain",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 415);
  });

  test("audio/webm upload succeeds → 200 with artifactId", async () => {
    const sessionId = "sess-audio-ok";
    await writeSessionOwnership(sessionId, "user-alice");

    const { request, context } = await buildUploadRequest({
      sessionId,
      contentType: "audio/webm",
      filename: "recording.webm",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${await res.clone().text()}`);

    const data = (await res.json()) as { artifactId: string; filename: string; mime: string; bytes: number };
    assert.ok(data.artifactId.startsWith("aud_"), "artifactId must start with aud_");
    assert.equal(data.mime, "audio/webm");
    assert.equal(data.bytes, 256);
    assert.ok(data.filename.endsWith(".webm"), "filename must end with .webm");
  });

  test("audio/mpeg upload succeeds (Whisper-compatible)", async () => {
    const sessionId = "sess-audio-mp3";
    await writeSessionOwnership(sessionId, "user-alice");

    const { request, context } = await buildUploadRequest({
      sessionId,
      contentType: "audio/mpeg",
      filename: "recording.mp3",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${await res.clone().text()}`);

    const data = (await res.json()) as { mime: string };
    assert.equal(data.mime, "audio/mpeg");
  });

  test("application/octet-stream upload succeeds (generic fallback)", async () => {
    const sessionId = "sess-audio-bin";
    await writeSessionOwnership(sessionId, "user-alice");

    const { request, context } = await buildUploadRequest({
      sessionId,
      contentType: "application/octet-stream",
      filename: "recording.webm",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${await res.clone().text()}`);
  });

  test("video/mp4 → 415 (not in allowlist)", async () => {
    const sessionId = "sess-audio-vid";
    await writeSessionOwnership(sessionId, "user-alice");

    const { request, context } = await buildUploadRequest({
      sessionId,
      contentType: "video/mp4",
      filename: "recording.mp4",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 415);
  });

  test("audio/webm;codecs=opus (Chrome MediaRecorder) → 200", async () => {
    const sessionId = "sess-audio-codecs";
    await writeSessionOwnership(sessionId, "user-alice");

    const { request, context } = await buildUploadRequest({
      sessionId,
      contentType: "audio/webm;codecs=opus",
      filename: "recording.webm",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${await res.clone().text()}`);
  });

  test("no content-type header → 415", async () => {
    const sessionId = "sess-audio-noct";
    await writeSessionOwnership(sessionId, "user-alice");

    const { request, context } = await buildUploadRequest({
      sessionId,
      contentType: "",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 415);
  });

  test("empty body → 400", async () => {
    const sessionId = "sess-audio-empty";
    await writeSessionOwnership(sessionId, "user-alice");

    // Send a request with an empty body (0 bytes)
    const { request, context } = await buildUploadRequest({
      sessionId,
      body: new Uint8Array(0),
    });
    const res = await POST(request, context);
    // Route should return 400 for empty audio
    assert.equal(res.status, 400);
  });

  test("unowned session → 404", async () => {
    const sessionId = "sess-audio-unowned";
    // Create ownership under a different user
    await writeSessionOwnership(sessionId, "user-bob");

    const { request, context } = await buildUploadRequest({
      sessionId,
    });
    const res = await POST(request, context);
    assert.equal(res.status, 404);
  });

  test("path-traversal sessionId → 400", async () => {
    const { request, context } = await buildUploadRequest({
      sessionId: "../etc/passwd",
    });
    const res = await POST(request, context);
    assert.equal(res.status, 400);
  });

  test("audio file is written to disk", async () => {
    const sessionId = "sess-audio-disk";
    await writeSessionOwnership(sessionId, "user-alice");

    const bodyBytes = fakeAudioBody(512);
    const { request, context } = await buildUploadRequest({
      sessionId,
      body: bodyBytes,
    });
    const res = await POST(request, context);
    assert.equal(res.status, 200);

    const data = (await res.json()) as { artifactId: string };
    const audioDir = path.join(artifactsRoot, sessionId, "audio");

    // Check that the audio file exists
    const files = await fs.readdir(audioDir);
    const audioFile = files.find((f) => f.startsWith(data.artifactId));
    assert.ok(audioFile, "audio file must exist on disk");

    // Check file has non-zero size (exact byte count may differ due to stream encoding)
    const stat = await fs.stat(path.join(audioDir, audioFile!));
    assert.ok(stat.size > 0, "audio file must have non-zero size");
  });
});
