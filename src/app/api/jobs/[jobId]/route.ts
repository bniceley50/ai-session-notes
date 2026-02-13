import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { jsonError } from "@/lib/api/errors";
import { cleanupJobArtifacts } from "@/lib/jobs/cleanup";
import { readJobStatusById, updateJobStatus } from "@/lib/jobs/status";
import { deleteJob } from "@/lib/jobs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  const status = await readJobStatusById(auth.jobId);
  if (!status) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  return Response.json(status);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  const status = await readJobStatusById(auth.jobId);
  if (!status) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  const updated = await updateJobStatus(auth.jobId, {
    status: "deleted",
    stage: "upload",
    progress: 0,
    errorMessage: null,
  });

  if (!updated) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  // Clean up filesystem artifacts + in-memory store entry.
  // Awaited so cleanup completes before response — safe for serverless runtimes.
  // cleanupJobArtifacts already swallows errors internally (best-effort).
  await cleanupJobArtifacts(auth.sessionId, auth.jobId);
  deleteJob(auth.jobId);

  return new Response(null, { status: 204 });
}

