import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth/session";
import { isDevLoginAllowed, defaultPracticeId } from "@/lib/config";
import { csrfCheck } from "@/lib/api/csrfCheck";

export const runtime = "nodejs";

/** Shared login logic used by both GET and POST handlers. */
async function handleDevLogin(request: Request): Promise<Response> {
  // Step 0: STRICT dev-only guard
  // Only works in NODE_ENV=development with explicit ALLOW_DEV_LOGIN=1
  if (!isDevLoginAllowed()) {
    return new Response("Not Found", { status: 404 });
  }

  const practiceId = defaultPracticeId();

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

/** GET — backwards-compatible dev-login (no CSRF check on safe method). */
export async function GET(request: Request): Promise<Response> {
  return handleDevLogin(request);
}

/** POST — preferred dev-login with CSRF guard. */
export async function POST(request: Request): Promise<Response> {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  return handleDevLogin(request);
}
