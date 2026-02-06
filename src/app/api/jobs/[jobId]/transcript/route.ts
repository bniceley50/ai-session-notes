import fs from "node:fs/promises";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { readSessionOwnership } from "@/lib/sessions/ownership";
import { readJobIndex, getJobTranscriptPath } from "@/lib/jobs/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId } = await context.params;

  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) return jsonError(401, "UNAUTHENTICATED", "unauthorized");

  const idx = await readJobIndex(jobId);
  if (!idx) return jsonError(404, "NOT_FOUND", "job not found");

  // deny-by-default: if ownership can't be proven, act like it doesn't exist
  const ownership = await readSessionOwnership(idx.sessionId);
  if (!ownership || ownership.ownerUserId !== session.sub) {
    return jsonError(404, "NOT_FOUND", "job not found");
  }

  const p = getJobTranscriptPath(idx.sessionId, jobId);

  try {
    const text = await fs.readFile(p, "utf8");
    return new Response(text, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    if (e?.code === "ENOENT") return jsonError(404, "NOT_FOUND", "transcript not found");
    return jsonError(500, "INTERNAL", "failed to read transcript");
  }
}
