/**
 * Tests for admin client fallback warning in the notes service.
 *
 * Verifies:
 * - Production mode: console.warn fires once when no user-scoped client is provided
 * - Development/test mode: no warning fires (admin fallback is expected for dev-login)
 * - Warn-once: second call does not produce a second warning
 * - Reset: _resetAdminFallbackWarning allows the warning to fire again
 */
import assert from "node:assert/strict";
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import { loadNote, _resetAdminFallbackWarning } from "@/lib/supabase/notes";

describe("resolveClient admin fallback warning", () => {
  let savedNodeEnv: string | undefined;
  let savedServiceRoleKey: string | undefined;
  let warnMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
    savedServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Provide a dummy service role key so requireAdminClient() doesn't throw
    // before we can observe the warning
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    // Reset the module-level warn-once flag before each test
    _resetAdminFallbackWarning();

    // Spy on console.warn
    warnMock = mock.fn();
    console.warn = warnMock;
  });

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceRoleKey;
    mock.restoreAll();
  });

  test("production mode: warns once when no user client provided", async () => {
    process.env.NODE_ENV = "production";

    // loadNote will fail (dummy Supabase URL) — we only care about the warning
    try {
      await loadNote("sess-1", "org-1", "soap", null);
    } catch {
      // Expected: Supabase query fails against dummy URL
    }

    assert.equal(warnMock.mock.calls.length, 1, "should warn exactly once");

    const [message, meta] = warnMock.mock.calls[0].arguments;
    assert.equal(message, "[notes] Admin client fallback used");
    assert.equal(meta.sessionId, "sess-1");
    assert.equal(meta.caller, "loadNote");
  });

  test("production mode: second call does not warn again (warn-once)", async () => {
    process.env.NODE_ENV = "production";

    // First call — triggers warning
    try {
      await loadNote("sess-1", "org-1", "soap", null);
    } catch {
      // Expected
    }

    // Second call — should NOT warn again
    try {
      await loadNote("sess-2", "org-1", "soap", null);
    } catch {
      // Expected
    }

    assert.equal(warnMock.mock.calls.length, 1, "should warn only once per process");
  });

  test("production mode: reset allows warning to fire again", async () => {
    process.env.NODE_ENV = "production";

    try {
      await loadNote("sess-1", "org-1", "soap", null);
    } catch {
      // Expected
    }
    assert.equal(warnMock.mock.calls.length, 1);

    // Reset and call again
    _resetAdminFallbackWarning();

    try {
      await loadNote("sess-2", "org-1", "soap", null);
    } catch {
      // Expected
    }
    assert.equal(warnMock.mock.calls.length, 2, "should warn again after reset");
  });

  test("development mode: no warning when no user client provided", async () => {
    process.env.NODE_ENV = "development";

    try {
      await loadNote("sess-1", "org-1", "soap", null);
    } catch {
      // Expected: Supabase query fails
    }

    assert.equal(warnMock.mock.calls.length, 0, "should not warn in development");
  });

  test("test mode: no warning when no user client provided", async () => {
    process.env.NODE_ENV = "test";

    try {
      await loadNote("sess-1", "org-1", "soap", null);
    } catch {
      // Expected: Supabase query fails
    }

    assert.equal(warnMock.mock.calls.length, 0, "should not warn in test mode");
  });

  test("no warning when user-scoped client is provided", async () => {
    process.env.NODE_ENV = "production";

    // Create a minimal mock client that satisfies the SupabaseClient interface
    // enough for resolveClient to return it (it just checks truthiness)
    const fakeClient = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }) }) }) }) };

    try {
      await loadNote("sess-1", "org-1", "soap", fakeClient as never);
    } catch {
      // May fail due to incomplete mock — that's fine
    }

    assert.equal(warnMock.mock.calls.length, 0, "should not warn when user client is provided");
  });
});
