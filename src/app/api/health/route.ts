/**
 * GET /api/health
 *
 * Unauthenticated liveness probe for uptime monitoring.
 * Response contract is intentionally minimal and stable:
 * only `status` and `timestamp` — do not add fields without
 * updating tests and docs/RELEASE_CHECKLIST.md.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
