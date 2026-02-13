// Unit tests for requireJobOwner() centralized auth helper.
//
// Validates the full auth chain: cookie → JWT → jobIndex → sessionOwnership → userId.
// Uses filesystem-backed indexes (via ARTIFACTS_ROOT set by setup-env.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { writeJobIndex } from "@/lib/jobs/status";
import { writeSessionOwnership } from "@/lib/sessions/ownership";
import { makeAuthCookie } from "../../../tests/helpers";

// ---------------------------------------------------------------------------
// No auth cookie → 401
// ---------------------------------------------------------------------------

describe("requireJobOwner", () => {
  test("no cookie → 401 UNAUTHENTICATED", async () => {
    const request = new Request("http://localhost/api/jobs/job-1", {
      method: "GET",
    });

    const result = await requireJobOwner(request, "job-1");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
      const body = (await result.response.json()) as { error?: { code?: string } };
      assert.equal(body.error?.code, "UNAUTHENTICATED");
    }
  });

  test("garbage cookie → 401 UNAUTHENTICATED", async () => {
    const request = new Request("http://localhost/api/jobs/job-1", {
      method: "GET",
      headers: { cookie: "asn_session=not-a-jwt" },
    });

    const result = await requireJobOwner(request, "job-1");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
    }
  });

  // ---------------------------------------------------------------------------
  // Bad jobId → 400
  // ---------------------------------------------------------------------------

  test("empty jobId → 400 BAD_REQUEST", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/jobs/", {
      method: "GET",
      headers: { cookie },
    });

    const result = await requireJobOwner(request, "");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 400);
    }
  });

  test("path-traversal jobId → 400 BAD_REQUEST", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/jobs/../../etc", {
      method: "GET",
      headers: { cookie },
    });

    const result = await requireJobOwner(request, "../../etc");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 400);
    }
  });

  // ---------------------------------------------------------------------------
  // Job not found → 404
  // ---------------------------------------------------------------------------

  test("job not in index → 404 NOT_FOUND", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/jobs/nonexistent", {
      method: "GET",
      headers: { cookie },
    });

    const result = await requireJobOwner(request, "nonexistent");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 404);
      const body = (await result.response.json()) as { error?: { code?: string } };
      assert.equal(body.error?.code, "NOT_FOUND");
    }
  });

  // ---------------------------------------------------------------------------
  // Different user owns session → 404 (don't leak existence)
  // ---------------------------------------------------------------------------

  test("valid cookie, different user owns session → 404", async () => {
    const jobId = `job-bob-${Date.now()}`;
    const sessionId = `sess-bob-${Date.now()}`;

    // Bob owns this session
    await writeSessionOwnership(sessionId, "user-bob");
    await writeJobIndex(jobId, sessionId);

    // Alice tries to access
    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const request = new Request(`http://localhost/api/jobs/${jobId}`, {
      method: "GET",
      headers: { cookie },
    });

    const result = await requireJobOwner(request, jobId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 404);
    }
  });

  // ---------------------------------------------------------------------------
  // Happy path → ok with jobId, sessionId, practiceId
  // ---------------------------------------------------------------------------

  test("valid cookie, correct owner → { ok: true, jobId, sessionId, practiceId }", async () => {
    const jobId = `job-alice-${Date.now()}`;
    const sessionId = `sess-alice-${Date.now()}`;

    await writeSessionOwnership(sessionId, "user-alice");
    await writeJobIndex(jobId, sessionId);

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId: "practice-test" });
    const request = new Request(`http://localhost/api/jobs/${jobId}`, {
      method: "GET",
      headers: { cookie },
    });

    const result = await requireJobOwner(request, jobId);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.jobId, jobId);
      assert.equal(result.sessionId, sessionId);
      assert.equal(result.practiceId, "practice-test");
    }
  });
});

