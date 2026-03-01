import fs from "node:fs/promises";
import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { downloadHeaders } from "@/lib/api/downloadHeaders";
import { getJobDraftPath } from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  const draftPath = getJobDraftPath(auth.sessionId, auth.jobId);

  try {
    const content = await fs.readFile(draftPath, "utf8");
    const headers = downloadHeaders(`draft-${auth.jobId}.md`, "text/plain; charset=utf-8");
    return new Response(content, { status: 200, headers });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: "NOT_FOUND", message: "Draft not found." } }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }
}
