import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { csrfCheck } from "@/lib/api/csrfCheck";

const BASE = "http://localhost:3000";

function makeRequest(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${BASE}/api/test`, { method, headers });
}

describe("csrfCheck", () => {
  // ── Safe methods always pass ───────────────────────────────────
  test("GET requests are always allowed (no Origin needed)", () => {
    assert.equal(csrfCheck(makeRequest("GET")), null);
  });

  test("HEAD requests are always allowed", () => {
    assert.equal(csrfCheck(makeRequest("HEAD")), null);
  });

  test("OPTIONS requests are always allowed", () => {
    assert.equal(csrfCheck(makeRequest("OPTIONS")), null);
  });

  // ── Same-origin POST allowed ───────────────────────────────────
  test("same-origin POST is allowed", () => {
    const result = csrfCheck(
      makeRequest("POST", { origin: BASE }),
    );
    assert.equal(result, null);
  });

  // ── Capacitor origin allowed ───────────────────────────────────
  test("capacitor://localhost origin is allowed", () => {
    const result = csrfCheck(
      makeRequest("POST", { origin: "capacitor://localhost" }),
    );
    assert.equal(result, null);
  });

  // ── Cross-origin blocked ───────────────────────────────────────
  test("cross-origin POST is blocked", () => {
    const result = csrfCheck(
      makeRequest("POST", { origin: "https://evil.com" }),
    );
    assert.notEqual(result, null);
    assert.equal(result!.status, 403);
  });

  // ── Missing Origin header blocked ──────────────────────────────
  test("POST without Origin or Referer is blocked", () => {
    const result = csrfCheck(makeRequest("POST"));
    assert.notEqual(result, null);
    assert.equal(result!.status, 403);
  });

  // ── Referer fallback ───────────────────────────────────────────
  test("same-origin Referer is allowed when Origin is missing", () => {
    const result = csrfCheck(
      makeRequest("POST", { referer: `${BASE}/some-page` }),
    );
    assert.equal(result, null);
  });

  test("cross-origin Referer is blocked", () => {
    const result = csrfCheck(
      makeRequest("POST", { referer: "https://evil.com/page" }),
    );
    assert.notEqual(result, null);
    assert.equal(result!.status, 403);
  });

  // ── DELETE works ───────────────────────────────────────────────
  test("same-origin DELETE is allowed", () => {
    const result = csrfCheck(
      makeRequest("DELETE", { origin: BASE }),
    );
    assert.equal(result, null);
  });

  test("cross-origin DELETE is blocked", () => {
    const result = csrfCheck(
      makeRequest("DELETE", { origin: "https://evil.com" }),
    );
    assert.notEqual(result, null);
    assert.equal(result!.status, 403);
  });

  // ── Error body structure ───────────────────────────────────────
  test("blocked response has CSRF_REJECTED error code", async () => {
    const result = csrfCheck(makeRequest("POST"));
    assert.notEqual(result, null);
    const body = (await result!.json()) as {
      error?: { code?: string; message?: string };
    };
    assert.equal(body.error?.code, "CSRF_REJECTED");
  });
});
