import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { purgeExpired } from "@/lib/jobs/store";
import { purgeExpiredJobArtifacts } from "@/lib/jobs/purge";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const inMemoryPurged = purgeExpired();
  const artifactPurge = await purgeExpiredJobArtifacts();
  return NextResponse.json({
    purged: Math.max(inMemoryPurged, artifactPurge.purgedJobs),
    purgedInMemory: inMemoryPurged,
    purgedArtifacts: artifactPurge.purgedJobs,
    purgedSessions: artifactPurge.purgedSessions,
  });
}
