/**
 * Tests for GET /api/test-session route.
 *
 * Verifies the strict dev-only guard: returns 404 in production,
 * test, and any non-development environment.
 *
 * Env vars are saved/restored per test to prevent cross-test bleed.
 */
import assert from "node:assert/strict";
import { describe, test, beforeEach, afterEach } from "node:test";
import { GET } from "./route";
import { makeAuthCookie } from "../../../../tests/helpers";

// ---------------------------------------------------------------------------
// Env isolation
// ---------------------------------------------------------------------------

let savedNodeEnv: string | undefined;

describe("GET /api/test-session", () => {
  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  });

  // ── Guard tests ───────────────────────────────────────────────

  test("returns 404 in production", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";

    const request = new Request("http://localhost:3000/api/test-session");
    const response = await GET(request);

    assert.equal(response.status, 404);
  });

  test("returns 404 in test env", async () => {
    (process.env as Record<string, string>).NODE_ENV = "test";

    const request = new Request("http://localhost:3000/api/test-session");
    const response = await GET(request);

    assert.equal(response.status, 404);
  });

  // ── Development behavior ──────────────────────────────────────

  test("returns session info in development with valid cookie", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";

    const cookie = await makeAuthCookie({ sub: "user-test", practiceId: "p-1" });
    const request = new Request("http://localhost:3000/api/test-session", {
      headers: { cookie },
    });
    const response = await GET(request);

    assert.equal(response.status, 200);
    const body = (await response.json()) as { hasSession: boolean; userId?: string };
    assert.equal(body.hasSession, true);
    assert.equal(body.userId, "user-test");
  });

  test("returns hasSession=false in development with no cookie", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";

    const request = new Request("http://localhost:3000/api/test-session");
    const response = await GET(request);

    assert.equal(response.status, 200);
    const body = (await response.json()) as { hasSession: boolean };
    assert.equal(body.hasSession, false);
  });
});
