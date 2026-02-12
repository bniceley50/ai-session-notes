import fs from "node:fs/promises";
import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { getJobTranscriptPath } from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  const transcriptPath = getJobTranscriptPath(auth.sessionId, auth.jobId);

  try {
    const content = await fs.readFile(transcriptPath, "utf8");
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: { code: "NOT_FOUND", message: "Transcript not found." } }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }
}
