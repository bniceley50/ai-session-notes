/**
 * Tests for middleware public path allowlist.
 *
 * Verifies that isPublicPath correctly identifies public vs protected routes.
 * Includes regression guards against accidental broadening of public API access.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isPublicPath } from "../middleware";

describe("isPublicPath", () => {
  // ── Health endpoint (new in PR5) ────────────────────────────

  test("/api/health is public", () => {
    assert.equal(isPublicPath("/api/health"), true);
  });

  test("/api/health/sub is NOT public (exact match only)", () => {
    assert.equal(isPublicPath("/api/health/sub"), false);
  });

  // ── Runner endpoint (public — has own token auth) ──────────

  test("/api/jobs/runner is public (Vercel cron + external scheduler)", () => {
    assert.equal(isPublicPath("/api/jobs/runner"), true);
  });

  test("/api/jobs/runner/sub is NOT public (exact match only)", () => {
    assert.equal(isPublicPath("/api/jobs/runner/sub"), false);
  });

  // ── Regression guards: unrelated API paths must stay protected ──

  test("/api/me is NOT public", () => {
    assert.equal(isPublicPath("/api/me"), false);
  });

  test("/api/sessions/123 is NOT public", () => {
    assert.equal(isPublicPath("/api/sessions/123"), false);
  });

  test("/api/jobs/create is NOT public", () => {
    assert.equal(isPublicPath("/api/jobs/create"), false);
  });

  // ── Auth routes: explicit allowlist (no longer prefix match) ──

  test("/api/auth/login is public (explicit path)", () => {
    assert.equal(isPublicPath("/api/auth/login"), true);
  });

  test("/api/auth/callback is public (explicit path)", () => {
    assert.equal(isPublicPath("/api/auth/callback"), true);
  });

  test("/api/auth/logout is public (explicit path)", () => {
    assert.equal(isPublicPath("/api/auth/logout"), true);
  });

  test("/api/auth/dev-login is public (explicit path)", () => {
    assert.equal(isPublicPath("/api/auth/dev-login"), true);
  });

  test("/api/auth/unknown-future-route is NOT public (no prefix match)", () => {
    assert.equal(isPublicPath("/api/auth/unknown-future-route"), false);
  });

  test("/login is public (exact path)", () => {
    assert.equal(isPublicPath("/login"), true);
  });

  test("/favicon.ico is public (exact path)", () => {
    assert.equal(isPublicPath("/favicon.ico"), true);
  });

  test("/_next/static/chunk.js is public (prefix match)", () => {
    assert.equal(isPublicPath("/_next/static/chunk.js"), true);
  });

  // ── Static file extensions ──────────────────────────────────

  test("/foo.js is public (static extension)", () => {
    assert.equal(isPublicPath("/foo.js"), true);
  });

  test("/images/logo.png is public (static extension)", () => {
    assert.equal(isPublicPath("/images/logo.png"), true);
  });

  test("/styles/main.css is public (static extension)", () => {
    assert.equal(isPublicPath("/styles/main.css"), true);
  });

  // ── Non-public page routes ──────────────────────────────────

  test("/ (root) is NOT public", () => {
    assert.equal(isPublicPath("/"), false);
  });

  test("/dashboard is NOT public", () => {
    assert.equal(isPublicPath("/dashboard"), false);
  });
});
