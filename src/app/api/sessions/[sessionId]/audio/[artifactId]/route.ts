import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { jsonError } from "@/lib/api/errors";
import { requireSessionOwner } from "@/lib/api/requireSessionOwner";
import { safePathSegment } from "@/lib/jobs/artifacts";
import { getAudioFilePath, readAudioMetadata } from "@/lib/jobs/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string; artifactId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId: sessionIdParam, artifactId: artifactIdParam } = await context.params;

  // ── Auth: shared session ownership check ─────────────────────
  const auth = await requireSessionOwner(request, sessionIdParam);
  if (!auth.ok) return auth.response;

  const { sessionId } = auth;

  const artifactId = typeof artifactIdParam === "string" ? artifactIdParam.trim() : "";
  if (!artifactId) {
    return jsonError(400, "BAD_REQUEST", "artifactId required.");
  }

  try {
    safePathSegment(artifactId);
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid artifactId.");
  }

  const meta = await readAudioMetadata(sessionId, artifactId);
  if (!meta) {
    return jsonError(404, "NOT_FOUND", "Audio artifact not found.");
  }

  const filePath = getAudioFilePath(sessionId, meta.storedName);
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return jsonError(404, "NOT_FOUND", "Audio artifact not found.");
  }

  const headers = new Headers();
  headers.set("Content-Type", meta.mime);
  headers.set("Content-Length", String(stat.size));
  headers.set("Content-Disposition", `attachment; filename=\"${meta.filename}\"`);

  const stream = createReadStream(filePath);
  return new Response(stream as unknown as ReadableStream, { headers });
}

