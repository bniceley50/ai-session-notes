import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * GET /api/auth/callback?code=...
 *
 * Supabase redirects here after the user consents at the OAuth provider.
 * We exchange the auth code for a Supabase session, extract user info,
 * mint our own app-level JWT session cookie, then redirect to the app.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  // Supabase may redirect with error params instead of a code
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    const desc = url.searchParams.get("error_description") ?? errorParam;
    console.error("[auth/callback] Supabase error redirect:", errorParam, desc);
    return NextResponse.redirect(
      new URL(`/login?error=missing_code&error_description=${encodeURIComponent(desc)}`, origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createSupabaseServerClient();

  // Exchange the PKCE code for a Supabase session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth/callback] Exchange error:", exchangeError.message);
    return NextResponse.redirect(new URL("/login?error=exchange_failed", origin));
  }

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.redirect(new URL("/login?error=no_user", origin));
  }

  // Mint our own app-level session cookie
  const practiceId = process.env.DEFAULT_PRACTICE_ID;
  if (!practiceId) {
    return NextResponse.json(
      { error: "Server misconfigured: missing DEFAULT_PRACTICE_ID" },
      { status: 500 },
    );
  }

  const sessionCookie = await createSessionCookie({
    sub: user.id,
    email: user.email,
    practiceId,
    role: "clinician",
  });

  const response = NextResponse.redirect(new URL("/sessions/new", origin));
  response.headers.append("set-cookie", sessionCookie);
  return response;
}
