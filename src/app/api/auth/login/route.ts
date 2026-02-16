import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Valid Supabase OAuth providers for this app */
const ALLOWED_PROVIDERS = ["google", "azure"] as const;
type AllowedProvider = (typeof ALLOWED_PROVIDERS)[number];

const isAllowedProvider = (value: string): value is AllowedProvider =>
  (ALLOWED_PROVIDERS as readonly string[]).includes(value);

/**
 * GET /api/auth/login?provider=google|azure
 *
 * Starts Supabase OAuth flow. Redirects user to the provider's consent
 * screen. Supabase handles PKCE state internally.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") ?? "";

  if (!isAllowedProvider(provider)) {
    return NextResponse.json(
      { error: "Invalid provider. Use ?provider=google or ?provider=azure" },
      { status: 400 },
    );
  }

  const origin = url.origin;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    return NextResponse.json(
      { error: "Failed to start authentication" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.url);
}

