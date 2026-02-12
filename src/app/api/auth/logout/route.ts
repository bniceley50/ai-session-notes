import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * GET /api/auth/logout
 *
 * Signs out the Supabase session and clears our app-level session cookie.
 * Redirects to the login page.
 */
export async function GET(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}
