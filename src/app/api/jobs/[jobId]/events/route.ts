import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { getJobWithProgress } from "@/lib/jobs/store";
import { jsonError } from "@/lib/api/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

/**
 * GET /api/jobs/[jobId]/events
 *
 * Returns the status-history events for a job from the in-memory store.
 * Auth: requireJobOwner (cookie → JWT → jobIndex → sessionOwnership → userId).
 *
 * NOTE: If the server process restarted since the job was created, the
 * in-memory store will be empty and this returns 404. This is expected —
 * callers should fall back to polling the filesystem-based status endpoint.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  const job = getJobWithProgress(auth.jobId);
  if (!job) {
    // In-memory store has no record (e.g. after process restart).
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  return Response.json({ jobId: auth.jobId, events: job.statusHistory }, { status: 200 });
}

