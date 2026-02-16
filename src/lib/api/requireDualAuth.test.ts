// Unit tests for requireDualAuth() dual-auth guard.
//
// Tests the Supabase session consistency layer that wraps requireSessionOwner.
// Uses a _supabaseFactory DI seam to avoid Next.js cookies() dependency.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { requireDualAuth, type DualAuthOptions } from "@/lib/api/requireDualAuth";
import { writeSessionOwnership } from "@/lib/sessions/ownership";
import { makeAuthCookie } from "../../../tests/helpers";

// ---------------------------------------------------------------------------
// Mock Supabase client factories
// ---------------------------------------------------------------------------

/** Simulates: no Supabase auth session (dev-login / cookie-less flow). */
const noSessionFactory: DualAuthOptions["_supabaseFactory"] = async () =>
  ({
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: { message: "No session", status: 401 },
      }),
    },
  }) as never;

/** Simulates: Supabase session present, user ID matches app JWT. */
const matchingUserFactory = (userId: string): DualAuthOptions["_supabaseFactory"] =>
  async () =>
    ({
      auth: {
        getUser: async () => ({
          data: { user: { id: userId } },
          error: null,
        }),
      },
      // Marker so we can assert the client was returned
      _testMarker: "user-scoped-client",
    }) as never;

/** Simulates: Supabase session present, user ID DIFFERENT from app JWT. */
const mismatchedUserFactory: DualAuthOptions["_supabaseFactory"] = async () =>
  ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "totally-different-user" } },
        error: null,
      }),
    },
  }) as never;

/** Simulates: Supabase client creation throws (e.g., missing env vars). */
const throwingFactory: DualAuthOptions["_supabaseFactory"] = async () => {
  throw new Error("Supabase unavailable");
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireDualAuth", () => {
  // ── Inherits requireSessionOwner behaviour ─────────────────────
  test("no cookie → 401 (delegates to requireSessionOwner)", async () => {
    const request = new Request("http://localhost/api/sessions/sess-1/notes", {
      method: "GET",
    });

    const result = await requireDualAuth(request, "sess-1", {
      _supabaseFactory: noSessionFactory,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
    }
  });

  test("session not found → 404 (delegates to requireSessionOwner)", async () => {
    const cookie = await makeAuthCookie();
    const request = new Request("http://localhost/api/sessions/nonexistent/notes", {
      method: "GET",
      headers: { cookie },
    });

    const result = await requireDualAuth(request, "nonexistent", {
      _supabaseFactory: noSessionFactory,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 404);
    }
  });

  // ── No Supabase session (dev-login flow) ──────────────────────
  test("no Supabase session → ok with null supabaseClient", async () => {
    const sessionId = `sess-dual-nosb-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId: "p-1" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/notes`,
      { method: "GET", headers: { cookie } },
    );

    const result = await requireDualAuth(request, sessionId, {
      _supabaseFactory: noSessionFactory,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sessionId, sessionId);
      assert.equal(result.userId, "user-alice");
      assert.equal(result.practiceId, "p-1");
      assert.equal(result.supabaseClient, null);
    }
  });

  test("no Supabase session + requireSupabaseSession=true → 401", async () => {
    const sessionId = `sess-dual-nosb-required-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId: "p-1" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/notes`,
      { method: "GET", headers: { cookie } },
    );

    const result = await requireDualAuth(request, sessionId, {
      requireSupabaseSession: true,
      _supabaseFactory: noSessionFactory,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
    }
  });

  // ── Supabase client creation throws → graceful degradation ────
  test("Supabase factory throws → ok with null supabaseClient", async () => {
    const sessionId = `sess-dual-throw-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/notes`,
      { method: "GET", headers: { cookie } },
    );

    const result = await requireDualAuth(request, sessionId, {
      _supabaseFactory: throwingFactory,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.supabaseClient, null);
    }
  });

  test("Supabase factory throws + requireSupabaseSession=true → 401", async () => {
    const sessionId = `sess-dual-throw-required-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/notes`,
      { method: "GET", headers: { cookie } },
    );

    const result = await requireDualAuth(request, sessionId, {
      requireSupabaseSession: true,
      _supabaseFactory: throwingFactory,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
    }
  });

  // ── Matching Supabase user → returns user-scoped client ───────
  test("matching Supabase user → ok with supabaseClient", async () => {
    const sessionId = `sess-dual-match-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId: "p-2" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/notes`,
      { method: "GET", headers: { cookie } },
    );

    const result = await requireDualAuth(request, sessionId, {
      _supabaseFactory: matchingUserFactory("user-alice"),
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sessionId, sessionId);
      assert.equal(result.userId, "user-alice");
      assert.equal(result.practiceId, "p-2");
      assert.notEqual(result.supabaseClient, null);
      // Verify the actual mock client was returned (not a fallback)
      assert.equal(
        (result.supabaseClient as unknown as Record<string, string>)._testMarker,
        "user-scoped-client",
      );
    }
  });

  // ── Mismatched Supabase user → 403 FORBIDDEN ─────────────────
  test("mismatched Supabase user → 403 FORBIDDEN", async () => {
    const sessionId = `sess-dual-mismatch-${Date.now()}`;
    await writeSessionOwnership(sessionId, "user-alice");

    const cookie = await makeAuthCookie({ sub: "user-alice" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/notes`,
      { method: "GET", headers: { cookie } },
    );

    const result = await requireDualAuth(request, sessionId, {
      _supabaseFactory: mismatchedUserFactory,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 403);
      const body = (await result.response.json()) as {
        error?: { code?: string; message?: string };
      };
      assert.equal(body.error?.code, "FORBIDDEN");
      assert.ok(body.error?.message?.includes("identity conflict"));
    }
  });

  // ── Options pass through to requireSessionOwner ───────────────
  test("allowAutocreate passes through to requireSessionOwner", async () => {
    // New session (not in ownership index yet) with allowAutocreate
    const sessionId = `sess-dual-auto-${Date.now()}`;

    const cookie = await makeAuthCookie({ sub: "user-alice", practiceId: "p-3" });
    const request = new Request(
      `http://localhost/api/sessions/${sessionId}/notes`,
      { method: "POST", headers: { cookie } },
    );

    const result = await requireDualAuth(request, sessionId, {
      allowAutocreate: true,
      _supabaseFactory: noSessionFactory,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sessionId, sessionId);
      assert.equal(result.userId, "user-alice");
    }
  });
});

