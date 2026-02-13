/**
 * Tests for GET /api/auth/dev-login route.
 *
 * Proves the dev-login endpoint is impossible to use in production
 * and that it correctly sets session cookies in development.
 *
 * Env vars are saved/restored per test to prevent cross-test bleed.
 */
import assert from "node:assert/strict";
import { describe, test, beforeEach, afterEach } from "node:test";
import { GET } from "./route";
import { readSessionFromCookieHeader } from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract "name=value" from a full Set-Cookie header string. */
const extractCookieValue = (setCookie: string): string =>
  setCookie.split(";")[0];

// ---------------------------------------------------------------------------
// Env isolation
// ---------------------------------------------------------------------------

const ENV_KEYS = ["NODE_ENV", "ALLOW_DEV_LOGIN", "DEFAULT_PRACTICE_ID"] as const;
const saved: Record<string, string | undefined> = {};

function enableDevLogin(): void {
  (process.env as Record<string, string>).NODE_ENV = "development";
  process.env.ALLOW_DEV_LOGIN = "1";
  process.env.DEFAULT_PRACTICE_ID ||= "practice-test";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/dev-login", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  // ── Gate tests: must be impossible in production ──────────────

  test("returns 404 when NODE_ENV=production (even with ALLOW_DEV_LOGIN=1)", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.ALLOW_DEV_LOGIN = "1";

    const request = new Request("http://localhost:3000/api/auth/dev-login");
    const response = await GET(request);

    assert.equal(response.status, 404);
  });

  test("returns 404 when ALLOW_DEV_LOGIN is missing (NODE_ENV=development)", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    delete process.env.ALLOW_DEV_LOGIN;

    const request = new Request("http://localhost:3000/api/auth/dev-login");
    const response = await GET(request);

    assert.equal(response.status, 404);
  });

  test("returns 404 when both conditions are unmet", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    delete process.env.ALLOW_DEV_LOGIN;

    const request = new Request("http://localhost:3000/api/auth/dev-login");
    const response = await GET(request);

    assert.equal(response.status, 404);
  });

  // ── Happy path: redirect + cookie in development ──────────────

  test("returns redirect with session cookie when dev-login is allowed", async () => {
    enableDevLogin();

    const request = new Request("http://localhost:3000/api/auth/dev-login");
    const response = await GET(request);

    // NextResponse.redirect returns 307 by default
    assert.equal(response.status, 307);
    assert.ok(response.headers.get("location")?.endsWith("/"));

    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie, "set-cookie header should be present");
    assert.ok(setCookie.includes("asn_session="), "cookie should be named asn_session");
  });

  // ── Query param: email ────────────────────────────────────────

  test("accepts email query param and includes it in cookie", async () => {
    enableDevLogin();

    const request = new Request(
      "http://localhost:3000/api/auth/dev-login?email=test@example.com",
    );
    const response = await GET(request);
    assert.equal(response.status, 307);

    const setCookie = response.headers.get("set-cookie")!;
    const cookieHeader = extractCookieValue(setCookie);
    const session = await readSessionFromCookieHeader(cookieHeader);

    assert.ok(session, "session should be readable from cookie");
    assert.equal(session.email, "test@example.com");
  });

  // ── Query param: role ─────────────────────────────────────────

  test("accepts role=admin query param", async () => {
    enableDevLogin();

    const request = new Request(
      "http://localhost:3000/api/auth/dev-login?role=admin",
    );
    const response = await GET(request);
    assert.equal(response.status, 307);

    const setCookie = response.headers.get("set-cookie")!;
    const cookieHeader = extractCookieValue(setCookie);
    const session = await readSessionFromCookieHeader(cookieHeader);

    assert.ok(session);
    assert.equal(session.role, "admin");
  });

  test("defaults to clinician role when no role param", async () => {
    enableDevLogin();

    const request = new Request("http://localhost:3000/api/auth/dev-login");
    const response = await GET(request);
    assert.equal(response.status, 307);

    const setCookie = response.headers.get("set-cookie")!;
    const cookieHeader = extractCookieValue(setCookie);
    const session = await readSessionFromCookieHeader(cookieHeader);

    assert.ok(session);
    assert.equal(session.role, "clinician");
    assert.equal(session.sub, "dev-user");
  });
});
