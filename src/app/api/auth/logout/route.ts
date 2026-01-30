import { NextResponse } from "next/server";
import { buildLogoutUrl } from "@/lib/auth/cognito";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const response = NextResponse.redirect(buildLogoutUrl());
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}