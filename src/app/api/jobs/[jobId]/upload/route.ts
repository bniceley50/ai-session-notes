import { type NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { jsonError } from "@/lib/api/errors";
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

/**
 * POST /api/jobs/[jobId]/upload
 *
 * Uploads an audio file for a job.
 * Auth: requireJobOwner (cookie → JWT → jobIndex → sessionOwnership → userId).
 *
 * The sessionId used for filesystem paths comes from the auth chain (jobIndex),
 * NOT from the client-supplied form field — preventing path-traversal via
 * spoofed sessionId values.
 *
 * NOTE: If the server process restarted since the job was created, the
 * in-memory store will be empty and this returns 404. This is expected —
 * the job must be re-created after a restart.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  // ── Auth: single-pass ownership check ──────────────────────────
  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  // ── Parse multipart form ───────────────────────────────────────
  // DEMO/STUB: formData() is not streaming; large uploads may buffer in memory.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "BAD_REQUEST", "invalid form data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "BAD_REQUEST", "file required");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "file too large");
  }

  // ── Verify in-memory store has the job ─────────────────────────
  const job = getJobWithProgress(auth.jobId);
  if (!job) {
    // In-memory store has no record (e.g. after process restart).
    return jsonError(404, "NOT_FOUND", "Job not found or not accessible.");
  }

  // ── Build safe filesystem path from auth chain (not client input) ──
  let jobDir: string;
  try {
    jobDir = getJobArtifactsDir(auth.practiceId, auth.sessionId, auth.jobId);
  } catch {
    return jsonError(400, "BAD_REQUEST", "invalid path segment");
  }

  if (!isWithinBase(ARTIFACTS_ROOT, jobDir)) {
    return jsonError(400, "BAD_REQUEST", "invalid path");
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

  const updated = recordJobUpload(auth.jobId, auth.practiceId, auth.sessionId, upload);
  if (!updated) {
    return jsonError(500, "INTERNAL", "failed to record upload");
  }

  return Response.json(updated, { status: 200 });
}

