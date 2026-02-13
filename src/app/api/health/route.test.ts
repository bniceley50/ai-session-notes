/**
 * Tests for GET /api/health.
 *
 * Response contract is intentionally minimal and stable:
 * only `status` ("ok") and `timestamp` (ISO string).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GET } from "./route";

describe("GET /api/health", () => {
  test("returns 200 with status ok", async () => {
    const response = GET();

    assert.equal(response.status, 200);
    const body = (await response.json()) as { status: string; timestamp: string };
    assert.equal(body.status, "ok");
  });

  test("works without auth cookie (unauthenticated)", async () => {
    // No cookie, no headers — should still return 200
    const response = GET();
    assert.equal(response.status, 200);
  });

  test("timestamp is a valid ISO string", async () => {
    const response = GET();
    const body = (await response.json()) as { timestamp: string };

    const parsed = new Date(body.timestamp);
    assert.ok(!isNaN(parsed.getTime()), "timestamp should parse as valid Date");
    assert.equal(body.timestamp, parsed.toISOString(), "timestamp should round-trip as ISO");
  });

  test("response contains only status and timestamp fields", async () => {
    const response = GET();
    const body = (await response.json()) as Record<string, unknown>;
    const keys = Object.keys(body).sort();

    assert.deepEqual(keys, ["status", "timestamp"]);
  });
});

