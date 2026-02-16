import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  return NextResponse.json({
    sub: session.sub,
    email: session.email,
    practiceId: session.practiceId,
    role: session.role,
  });
}

