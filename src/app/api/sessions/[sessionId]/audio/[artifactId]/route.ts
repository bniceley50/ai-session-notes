import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { safePathSegment } from "@/lib/jobs/artifacts";
import { readSessionOwnership } from "@/lib/sessions/ownership";
import { getAudioFilePath, readAudioMetadata } from "@/lib/jobs/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string; artifactId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const { sessionId: sessionIdParam, artifactId: artifactIdParam } = await context.params;
  const sessionId = typeof sessionIdParam === "string" ? sessionIdParam.trim() : "";
  const artifactId = typeof artifactIdParam === "string" ? artifactIdParam.trim() : "";

  if (!sessionId || !artifactId) {
    return jsonError(400, "BAD_REQUEST", "sessionId and artifactId required.");
  }

  try {
    safePathSegment(sessionId);
    safePathSegment(artifactId);
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid path segment.");
  }

  const ownership = await readSessionOwnership(sessionId);
  if (!ownership || ownership.ownerUserId !== session.sub) {
    return jsonError(404, "NOT_FOUND", "Audio artifact not found.");
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
