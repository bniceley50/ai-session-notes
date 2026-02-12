import { NextResponse } from "next/server";
import { processQueuedJobs } from "@/lib/jobs/runner";
import { purgeExpiredJobArtifacts } from "@/lib/jobs/purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify runner authentication token
 * Prevents unauthorized API spending
 */
function verifyRunnerAuth(request: Request): boolean {
  const token = process.env.JOBS_RUNNER_TOKEN;

  // If no token configured, deny access in production
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    // Allow in development without token for convenience
    return true;
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const bearer = authHeader.split(" ");
    if (bearer.length === 2 && bearer[0] === "Bearer" && bearer[1] === token) {
      return true;
    }
  }

  // Check x-runner-token header
  const tokenHeader = request.headers.get("x-runner-token");
  if (tokenHeader === token) {
    return true;
  }

  return false;
}

/**
 * Job Runner Endpoint
 *
 * This endpoint processes all queued jobs. It can be called by:
 * - A cron job (e.g., every minute)
 * - Vercel/Netlify scheduled functions
 * - Manual trigger for debugging
 *
 * SECURITY: Requires JOBS_RUNNER_TOKEN to prevent unauthorized API spending.
 * Set Authorization: Bearer <token> or x-runner-token: <token> header.
 *
 * In development, jobs are started via setTimeout in /api/jobs/create.
 * In production, this endpoint should be called regularly by a scheduler.
 */
export async function POST(request: Request): Promise<Response> {
  // Verify authentication
  if (!verifyRunnerAuth(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized. Set JOBS_RUNNER_TOKEN and include Authorization header.",
      },
      { status: 401 }
    );
  }
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
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: "ok",
    endpoint: "Job Runner",
    usage: "POST to this endpoint to process queued jobs",
  });
}
