// Route handler integration tests for GET /api/jobs/[jobId]/events
//
// Auth chain: requireJobOwner (cookie → JWT → jobIndex → sessionOwnership → userId).
// Data source: in-memory store (getJobWithProgress).
//
// NOTE: The in-memory store is empty in test unless we seed it. Since the store
// is a plain Map that lives in the same process, we can import and seed directly.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GET } from "@/app/api/jobs/[jobId]/events/route";
import { writeJobIndex } from "@/lib/jobs/status";
import { writeSessionOwnership } from "@/lib/sessions/ownership";
import { createJob } from "@/lib/jobs/store";
import { makeAuthCookie } from "../../../../../../tests/helpers";

// Helper to build a Request + RouteContext for the events endpoint
function makeEventsRequest(jobId: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;

  const request = new Request(`http://localhost/api/jobs/${jobId}/events`, {
    method: "GET",
    headers,
  });

  const context = { params: Promise.resolve({ jobId }) };
  return { request, context };
}

describe("GET /api/jobs/[jobId]/events", () => {
  // ---------------------------------------------------------------------------
  // Auth rejection
  // ---------------------------------------------------------------------------

  test("no cookie → 401", async () => {
    const { request, context } = makeEventsRequest("job-1");
    const response = await GET(request, context);
    assert.equal(response.status, 401);

    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "UNAUTHENTICATED");
  });

  test("garbage cookie → 401", async () => {
    const { request, context } = makeEventsRequest("job-1", "asn_session=garbage");
    const response = await GET(request, context);
    assert.equal(response.status, 401);
  });

  // ---------------------------------------------------------------------------
  // Ownership enforcement
  // ---------------------------------------------------------------------------

  test("authenticated non-owner → 404", async () => {
    const jobId = `job-events-bob-${Date.now()}`;
    const sessionId = `sess-events-bob-${Date.now()}`;

    await writeSessionOwnership(sessionId, "user-bob");
    await writeJobIndex(jobId, sessionId);

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const { request, context } = makeEventsRequest(jobId, cookie);
    const response = await GET(request, context);
    assert.equal(response.status, 404);
  });

  test("job not in filesystem index → 404", async () => {
    const cookie = await makeAuthCookie();
    const { request, context } = makeEventsRequest("nonexistent-job", cookie);
    const response = await GET(request, context);
    assert.equal(response.status, 404);
  });

  // ---------------------------------------------------------------------------
  // Happy path (requires both filesystem index AND in-memory store)
  // ---------------------------------------------------------------------------

  test("owner + job in store → 200 with events array", async () => {
    const jobId = `job-events-alice-${Date.now()}`;
    const sessionId = `sess-events-alice-${Date.now()}`;
    const practiceId = "practice-test";

    // Seed filesystem ownership chain
    await writeSessionOwnership(sessionId, "user-alice");
    await writeJobIndex(jobId, sessionId);

    // Seed in-memory store — createJob(practiceId, sessionId, jobId)
    createJob(practiceId, sessionId, jobId);

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId });
    const { request, context } = makeEventsRequest(jobId, cookie);
    const response = await GET(request, context);
    assert.equal(response.status, 200);

    const body = (await response.json()) as { jobId?: string; events?: unknown[] };
    assert.equal(body.jobId, jobId);
    assert.ok(Array.isArray(body.events), "events must be an array");
  });

  test("owner but job NOT in in-memory store → 404 (process restart scenario)", async () => {
    // Filesystem says Alice owns this job, but in-memory store doesn't have it
    const jobId = `job-events-restart-${Date.now()}`;
    const sessionId = `sess-events-restart-${Date.now()}`;

    await writeSessionOwnership(sessionId, "user-alice");
    await writeJobIndex(jobId, sessionId);
    // Deliberately NOT seeding the in-memory store

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const { request, context } = makeEventsRequest(jobId, cookie);
    const response = await GET(request, context);
    assert.equal(response.status, 404);
  });
});

