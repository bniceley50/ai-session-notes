import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { csrfCheck } from "@/lib/api/csrfCheck";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 *
 * Signs out the Supabase session and clears our app-level session cookie.
 * Redirects to the login page. Requires same-origin (CSRF guard).
 */
export async function POST(request: Request): Promise<Response> {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}

/**
 * GET /api/auth/logout — Method Not Allowed.
 *
 * Logout is a state-changing action and must use POST.
 */
export function GET(): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { allow: "POST" },
  });
}
