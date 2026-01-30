import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { exchangeCodeForTokens, verifyIdToken } from "@/lib/auth/cognito";
import {
  clearStateCookie,
  createSessionCookie,
  readStateFromCookieHeader,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const stateCookie = readStateFromCookieHeader(request.headers.get("cookie"));
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  try {
    const { idToken } = await exchangeCodeForTokens(code);
    const { sub, email } = await verifyIdToken(idToken);

    const sessionCookie = await createSessionCookie({
      sub,
      email,
      practiceId: authConfig.defaultPracticeId,
      role: "clinician",
    });

    const response = NextResponse.redirect(new URL("/", request.url));
    response.headers.append("set-cookie", sessionCookie);
    response.headers.append("set-cookie", clearStateCookie());
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
  }
}