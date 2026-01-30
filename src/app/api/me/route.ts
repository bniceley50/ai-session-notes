import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    sub: session.sub,
    email: session.email,
    practiceId: session.practiceId,
    role: session.role,
  });
}