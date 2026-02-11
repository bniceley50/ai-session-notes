import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Test endpoint to check session authentication
 * GET /api/test-session
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await readSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({
        error: "No session found",
        hasSession: false,
      }, { status: 200 });
    }

    return NextResponse.json({
      hasSession: true,
      userId: session.sub,
      practiceId: session.practiceId,
      practiceIdType: typeof session.practiceId,
      practiceIdIsUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.practiceId),
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
