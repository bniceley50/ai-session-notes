import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  // Step 0: STRICT dev-only guard
  // Only works in NODE_ENV=development with explicit ALLOW_DEV_LOGIN=1
  if (process.env.NODE_ENV !== "development" || process.env.ALLOW_DEV_LOGIN !== "1") {
    return new Response("Not Found", { status: 404 });
  }

  const practiceId = process.env.DEFAULT_PRACTICE_ID;
  if (!practiceId) {
    return NextResponse.json({ error: "Missing DEFAULT_PRACTICE_ID" }, { status: 500 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? undefined;
  const roleParam = url.searchParams.get("role");
  const role = roleParam === "admin" ? "admin" : "clinician";

  const cookie = await createSessionCookie({
    sub: "dev-user",
    email,
    practiceId,
    role,
  });

  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.append("set-cookie", cookie);
  return response;
}