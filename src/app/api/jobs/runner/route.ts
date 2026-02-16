import { NextResponse } from "next/server";
import { processQueuedJobs } from "@/lib/jobs/runner";
import { purgeExpiredJobArtifacts } from "@/lib/jobs/purge";
import { jobsRunnerToken, cronSecret, isProduction } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Auth helpers ────────────────────────────────────────────

/**
 * Extract Bearer token from Authorization header, if present.
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
}

/**
 * Verify runner authentication for POST requests (external scheduler / manual).
 * Accepts: Authorization: Bearer <JOBS_RUNNER_TOKEN> or x-runner-token header.
 */
function verifyRunnerAuth(request: Request): boolean {
  const token = jobsRunnerToken();

  // If no token configured, deny access in production
  if (!token) {
    return !isProduction();
  }

  // Check Authorization header (Bearer token)
  const bearer = extractBearerToken(request);
  if (bearer === token) return true;

  // Check x-runner-token header (legacy / convenience)
  const tokenHeader = request.headers.get("x-runner-token");
  if (tokenHeader === token) return true;

  return false;
}

/**
 * Verify Vercel cron authentication for GET requests.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron
 * invocation.  If CRON_SECRET is configured, we require a match.
 * If CRON_SECRET is not set (non-Vercel host), fall back to
 * JOBS_RUNNER_TOKEN validation so external schedulers can use GET too.
 */
function verifyCronAuth(request: Request): boolean {
  const bearer = extractBearerToken(request);

  // 1. Try CRON_SECRET first (Vercel cron)
  const cron = cronSecret();
  if (cron && bearer === cron) return true;

  // 2. Fall back to JOBS_RUNNER_TOKEN (external scheduler via GET)
  const runner = jobsRunnerToken();
  if (runner) {
    if (bearer === runner) return true;
    const tokenHeader = request.headers.get("x-runner-token");
    if (tokenHeader === runner) return true;
    return false;
  }

  // 3. No secrets configured — deny in production, allow in dev
  return !isProduction();
}

// ── Shared runner logic ─────────────────────────────────────

async function executeRunner(): Promise<Response> {
  try {
    const purge = await purgeExpiredJobArtifacts();
    const processed = await processQueuedJobs();

    return NextResponse.json({
      success: true,
      processed,
      purged: purge.purgedJobs,
      purgedSessions: purge.purgedSessions,
      message: `Processed ${processed} queued job(s), purged ${purge.purgedJobs} expired job(s)`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

// ── Route handlers ──────────────────────────────────────────

/**
 * GET /api/jobs/runner — Vercel cron entry point.
 *
 * Vercel cron sends GET requests with `Authorization: Bearer <CRON_SECRET>`.
 * Also accepts JOBS_RUNNER_TOKEN for non-Vercel schedulers that prefer GET.
 *
 * Schedule: every 15 minutes (configured in vercel.json).
 * Processes queued jobs and purges expired artifacts + stale session locks.
 */
export async function GET(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Set CRON_SECRET or JOBS_RUNNER_TOKEN." },
      { status: 401 },
    );
  }
  return executeRunner();
}

/**
 * POST /api/jobs/runner — External scheduler / manual trigger.
 *
 * Requires JOBS_RUNNER_TOKEN via Authorization header or x-runner-token.
 * In development, works without a token for convenience.
 */
export async function POST(request: Request): Promise<Response> {
  if (!verifyRunnerAuth(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized. Set JOBS_RUNNER_TOKEN and include Authorization header.",
      },
      { status: 401 },
    );
  }
  return executeRunner();
}

