import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { advanceJob } from "@/lib/jobs/store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { jobId } = await context.params;
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = advanceJob(jobId, session.practiceId, "drafted");
  if (!job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(job, { status: 200 });
}
