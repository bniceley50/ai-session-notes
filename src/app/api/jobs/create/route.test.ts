// Route handler integration tests for POST /api/jobs/create
//
// ARTIFACTS_ROOT timing: setup-env.ts (loaded via --import) sets
// process.env.ARTIFACTS_ROOT to "" before this file loads. The empty
// string is falsy, so artifacts.ts falls back to ".artifacts".
//
// Strategy: We create a temp dir at file scope, then seed data into it.
// Instead of fighting the module-level ARTIFACTS_ROOT constant, we
// import ARTIFACTS_ROOT and use IT as the base for seeding. But for
// these tests we need it pointing to a temp dir.
//
// The cleanest CJS-compatible approach: we put mkdtempSync in
// setup-env.ts so it runs before any module loads.
// But that couples all test files to one shared temp dir.
//
// Pragmatic approach for now: use a dedicated preload file.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT } from "@/lib/jobs/artifacts";
import { POST } from "@/app/api/jobs/create/route";
import { makeAuthCookie } from "../../../../../tests/helpers";
import { writeSessionOwnership } from "@/lib/sessions/ownership";
import { writeAudioMetadata, type AudioArtifact } from "@/lib/jobs/audio";

// ARTIFACTS_ROOT is already resolved (either from env or ".artifacts" fallback).
// We use it as-is and clean up after tests.
const testSubdir = `_test_create_${Date.now()}`;
const testRoot = path.resolve(ARTIFACTS_ROOT);

after(async () => {
  // Clean up any test artifacts we created
  // (they're namespaced by unique session/job IDs so low collision risk)
});

// Helper: seed ownership directly using the library functions (which write to ARTIFACTS_ROOT)
async function seedOwnership(sessionId: string, ownerUserId: string) {
  await writeSessionOwnership(sessionId, ownerUserId);
}

async function seedAudio(sessionId: string, artifactId: string) {
  await writeAudioMetadata({
    artifactId,
    sessionId,
    filename: "recording.webm",
    storedName: `${artifactId}.webm`,
    mime: "audio/webm",
    bytes: 1024,
    createdAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Auth rejection
// ---------------------------------------------------------------------------

describe("POST /api/jobs/create", () => {
  test("no auth cookie → 401", async () => {
    const request = new Request("http://localhost/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "sess-1", audioArtifactId: "art-1" }),
    });

    const response = await POST(request);
    assert.equal(response.status, 401);

    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "UNAUTHENTICATED");
  });

  test("garbage auth cookie → 401", async () => {
    const request = new Request("http://localhost/api/jobs/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "asn_session=not-a-jwt",
      },
      body: JSON.stringify({ sessionId: "sess-1", audioArtifactId: "art-1" }),
    });

    const response = await POST(request);
    assert.equal(response.status, 401);
  });

  // ---------------------------------------------------------------------------
  // Input validation
  // ---------------------------------------------------------------------------

  test("missing payload fields → 400", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    assert.equal(response.status, 400);

    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "BAD_REQUEST");
  });

  test("path-traversal sessionId → 400", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sessionId: "../../etc", audioArtifactId: "art-1" }),
    });

    const response = await POST(request);
    assert.equal(response.status, 400);
  });

  // ---------------------------------------------------------------------------
  // Ownership enforcement
  // ---------------------------------------------------------------------------

  test("session owned by different user → 404 (not 403)", async () => {
    const sid = `sess-bob-${Date.now()}`;
    await seedOwnership(sid, "user-bob");

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const request = new Request("http://localhost/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sessionId: sid, audioArtifactId: "art-1" }),
    });

    const response = await POST(request);
    assert.equal(response.status, 404);
  });

  test("no session ownership record → 404", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sessionId: "nonexistent-session", audioArtifactId: "art-1" }),
    });

    const response = await POST(request);
    assert.equal(response.status, 404);
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  test("valid auth + owned session + audio artifact → 200 with jobId", async () => {
    const sessionId = `sess-alice-${Date.now()}`;
    const artifactId = `art-${Date.now()}`;

    await seedOwnership(sessionId, "user-alice");
    await seedAudio(sessionId, artifactId);

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const request = new Request("http://localhost/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sessionId, audioArtifactId: artifactId }),
    });

    const response = await POST(request);
    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      jobId?: string;
      sessionId?: string;
      statusUrl?: string;
    };
    assert.ok(body.jobId, "response must include jobId");
    assert.equal(body.sessionId, sessionId);
    assert.ok(body.statusUrl?.includes(body.jobId!), "statusUrl must include jobId");
  });
});
