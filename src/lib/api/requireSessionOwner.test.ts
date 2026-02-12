// Unit tests for requireSessionOwner() centralized auth helper.
//
// Validates the full auth chain: cookie → JWT → sessionOwnership → userId.
// Uses filesystem-backed indexes (via ARTIFACTS_ROOT set by setup-env.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { requireSessionOwner } from "@/lib/api/requireSessionOwner";
import { writeSessionOwnership } from "@/lib/sessions/ownership";
import { makeAuthCookie } from "../../../tests/helpers";

// ---------------------------------------------------------------------------
// No auth cookie → 401
// ---------------------------------------------------------------------------

describe("requireSessionOwner", () => {
  test("no cookie → 401 UNAUTHENTICATED", async () => {
    const request = new Request("http://localhost/api/sessions/sess-1/audio", {
      method: "POST",
    });

    const result = await requireSessionOwner(request, "sess-1");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
      const body = (await result.response.json()) as {
        error?: { code?: string };
      };
      assert.equal(body.error?.code, "UNAUTHENTICATED");
    }
  });

  test("garbage cookie → 401 UNAUTHENTICATED", async () => {
    const request = new Request("http://localhost/api/sessions/sess-1/audio", {
      method: "POST",
      headers: { cookie: "asn_session=not-a-jwt" },
    });

    const result = await requireSessionOwner(request, "sess-1");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
    }
  });

  // ---------------------------------------------------------------------------
  // Bad sessionId → 400
  // ---------------------------------------------------------------------------

  test("empty sessionId → 400 BAD_REQUEST", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/sessions//audio", {
      method: "POST",
      headers: { cookie },
    });

    const result = await requireSessionOwner(request, "");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 400);
      const body = (await result.response.json()) as {
        error?: { code?: string };
      };
      assert.equal(body.error?.code, "BAD_REQUEST");
    }
  });

  test("path-traversal sessionId → 400 BAD_REQUEST", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/sessions/../../etc", {
      method: "POST",
      headers: { cookie },
    });

    const result = await requireSessionOwner(request, "../../etc");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 400);
    }
  });

  // ---------------------------------------------------------------------------
  // Session not found → 404
  // ---------------------------------------------------------------------------

  test("session not in ownership index → 404 NOT_FOUND", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request(
      "http://localhost/api/sessions/nonexistent/audio",
      { method: "POST", headers: { cookie } },
    );

    const result = await requireSessionOwner(request, "nonexistent");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 404);
      const body = (await result.response.json()) as {
        error?: { code?: string };
      };
      assert.equal(body.error?.code, "NOT_FOUND");
    }
  });

  // ---------------------------------------------------------------------------
  // Different user owns session → 404 (don't leak existence)
  // ---------------------------------------------------------------------------

  test("valid cookie, different user owns session → 404", async () => {
    const sessionId = `sess-bob-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-bob");

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/audio`,
      { method: "POST", headers: { cookie } },
    );

    const result = await requireSessionOwner(request, sessionId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 404);
    }
  });

  // ---------------------------------------------------------------------------
  // Happy path → ok with sessionId, userId, practiceId
  // ---------------------------------------------------------------------------

  test("valid cookie, correct owner → { ok, sessionId, userId, practiceId }", async () => {
    const sessionId = `sess-alice-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({
      sub: "user-alice",
      practiceId: "practice-test",
    });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/audio`,
      { method: "POST", headers: { cookie } },
    );

    const result = await requireSessionOwner(request, sessionId);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sessionId, sessionId);
      assert.equal(result.userId, "user-alice");
      assert.equal(result.practiceId, "practice-test");
    }
  });

  // ---------------------------------------------------------------------------
  // practiceId flows through from authenticated session (not ownership record)
  // ---------------------------------------------------------------------------

  test("practiceId comes from JWT, not ownership record", async () => {
    const sessionId = `sess-practice-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({
      sub: "user-alice",
      practiceId: "practice-xyz",
    });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/audio`,
      { method: "POST", headers: { cookie } },
    );

    const result = await requireSessionOwner(request, sessionId);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.practiceId, "practice-xyz");
    }
  });
});
