import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { createJob } from "@/lib/jobs/store";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = createJob(session.practiceId);
  return NextResponse.json(job, { status: 200 });
}
