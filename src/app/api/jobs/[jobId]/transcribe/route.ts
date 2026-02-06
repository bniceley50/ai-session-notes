import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { getJobWithProgress, recordJobTranscribed } from "@/lib/jobs/store";
import { ARTIFACTS_ROOT, getJobArtifactsDir } from "@/lib/jobs/artifacts";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function isWithinBase(baseDir: string, targetDir: string): boolean {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetDir);
  const rel = path.relative(base, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { jobId } = await context.params;

  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { sessionId?: unknown } = {};
  try {
    payload = (await request.json()) as { sessionId?: unknown };
  } catch {
    payload = {};
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const job = getJobWithProgress(jobId);
  if (!job || job.practiceId !== session.practiceId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (job.sessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 409 });
  }

  let jobDir: string;
  try {
    jobDir = getJobArtifactsDir(session.practiceId, sessionId, jobId);
  } catch {
    return NextResponse.json({ error: "invalid path segment" }, { status: 400 });
  }

  if (!isWithinBase(ARTIFACTS_ROOT, jobDir)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  await fs.mkdir(jobDir, { recursive: true });

  // DEMO/STUB: transcript content is fake, but file must exist.
  const transcriptPath = path.join(jobDir, "transcript.txt");
  await fs.writeFile(transcriptPath, "DEMO/STUB transcript\n", "utf8");

  const updated = recordJobTranscribed(jobId, session.practiceId, sessionId);
  if (!updated) {
    return NextResponse.json({ error: "failed to record transcript" }, { status: 500 });
  }

  return NextResponse.json(updated, { status: 200 });
}