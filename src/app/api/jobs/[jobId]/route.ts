import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { deleteJob, getJob } from "@/lib/jobs/store";

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

  const job = getJob(jobId);
  if (!job || job.practiceId !== session.practiceId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { jobId } = await context.params;
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = getJob(jobId);
  if (!job || job.practiceId !== session.practiceId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  deleteJob(job.id);
  return new Response(null, { status: 204 });
}
