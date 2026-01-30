import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { purgeExpired } from "@/lib/jobs/store";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const purged = purgeExpired();
  return NextResponse.json({ purged });
}