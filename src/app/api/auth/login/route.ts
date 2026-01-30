import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/auth/cognito";
import { createStateCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const state = randomUUID();
  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  response.headers.append("set-cookie", createStateCookie(state));
  return response;
}