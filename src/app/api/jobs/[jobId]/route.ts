import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { safePathSegment } from "@/lib/jobs/artifacts";
import { readSessionOwnership } from "@/lib/sessions/ownership";
import { readJobStatusById, updateJobStatus } from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const jobId = typeof jobIdParam === "string" ? jobIdParam.trim() : "";
  if (!jobId) {
    return jsonError(400, "BAD_REQUEST", "jobId required.");
  }

  try {
    safePathSegment(jobId);
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid jobId.");
  }

  const status = await readJobStatusById(jobId);
  if (!status) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  const ownership = await readSessionOwnership(status.sessionId);
  if (!ownership || ownership.ownerUserId !== session.sub) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  return Response.json(status);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const jobId = typeof jobIdParam === "string" ? jobIdParam.trim() : "";
  if (!jobId) {
    return jsonError(400, "BAD_REQUEST", "jobId required.");
  }

  try {
    safePathSegment(jobId);
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid jobId.");
  }

  const status = await readJobStatusById(jobId);
  if (!status) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  const ownership = await readSessionOwnership(status.sessionId);
  if (!ownership || ownership.ownerUserId !== session.sub) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  const updated = await updateJobStatus(jobId, {
    status: "deleted",
    stage: "upload",
    progress: 0,
    errorMessage: null,
  });

  if (!updated) {
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  return new Response(null, { status: 204 });
}



