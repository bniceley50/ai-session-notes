import fs from "node:fs/promises";
import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { jsonError } from "@/lib/api/errors";
import { getJobExportPath } from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

/**
 * GET /api/jobs/[jobId]/export
 *
 * Returns the plain-text export (SOAP note) for a completed job.
 * Auth: requireJobOwner (cookie → JWT → jobIndex → sessionOwnership → userId).
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  const p = getJobExportPath(auth.sessionId, auth.jobId);

  try {
    const text = await fs.readFile(p, "utf8");
    return new Response(text, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    if (e?.code === "ENOENT") return jsonError(404, "NOT_FOUND", "export not found");
    return jsonError(500, "INTERNAL", "failed to read export");
  }
}

