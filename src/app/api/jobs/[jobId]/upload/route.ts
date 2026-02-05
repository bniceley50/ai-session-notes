import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { getJobWithProgress, recordJobUpload } from "@/lib/jobs/store";
import { ARTIFACTS_ROOT, getJobArtifactsDir, safeFilename } from "@/lib/jobs/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = {
  params: Promise<{ jobId: string }>;
};

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

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

  // DEMO/STUB: formData() is not streaming; large uploads may buffer in memory.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const sessionIdRaw = form.get("sessionId");
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
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

  const audioDir = path.join(jobDir, "audio");
  await fs.mkdir(audioDir, { recursive: true });

  const storedName = safeFilename(file.name);
  const destPath = path.join(audioDir, storedName);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(destPath, buf);

  const upload = {
    originalName: file.name,
    storedName,
    bytes: file.size,
    uploadedAt: new Date().toISOString(),
  };

  const sidecarPath = path.join(jobDir, "upload.json");
  await fs.writeFile(sidecarPath, JSON.stringify(upload, null, 2), "utf8");

  const updated = recordJobUpload(jobId, session.practiceId, sessionId, upload);
  if (!updated) {
    return NextResponse.json({ error: "failed to record upload" }, { status: 500 });
  }

  return NextResponse.json(updated, { status: 200 });
}



