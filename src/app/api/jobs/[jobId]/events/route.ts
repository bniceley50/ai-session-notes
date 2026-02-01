import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { getJobWithProgress } from "@/lib/jobs/store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId } = await context.params;
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== session.practiceId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ jobId, events: job.statusHistory }, { status: 200 });
}
