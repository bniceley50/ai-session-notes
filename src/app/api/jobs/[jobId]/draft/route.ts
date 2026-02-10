import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { readJobIndex, getJobDraftPath } from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { jobId } = await context.params;

  // Look up the job to get sessionId
  const index = await readJobIndex(jobId);
  if (!index) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const draftPath = getJobDraftPath(index.sessionId, jobId);

  try {
    const content = await fs.readFile(draftPath, "utf8");
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
}
