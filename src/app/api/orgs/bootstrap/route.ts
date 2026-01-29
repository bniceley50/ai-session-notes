import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BootstrapRequest = {
  name?: string;
};

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError("Server misconfigured", 500);
  }

  const token = getBearerToken(request);
  if (!token) {
    return jsonError("Missing bearer token", 401);
  }

  let payload: BootstrapRequest = {};
  try {
    payload = (await request.json()) as BootstrapRequest;
  } catch {
    payload = {};
  }

  const rawName = typeof payload.name === "string" ? payload.name : "";
  const name = rawName.trim();
  if (!name) {
    return jsonError("Missing org name", 400);
  }
  if (name.length > 120) {
    return jsonError("Org name too long", 400);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } =
    await authClient.auth.getUser(token);

  if (userError || !userData?.user) {
    return jsonError("Unauthorized", 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: org, error: orgError } = await adminClient
    .from("orgs")
    .insert({ name })
    .select("id, name, created_at")
    .single();

  if (orgError || !org) {
    return jsonError("Internal server error", 500);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .insert({ user_id: userData.user.id, org_id: org.id })
    .select("id, user_id, org_id, created_at")
    .single();

  if (profileError || !profile) {
    return jsonError("Internal server error", 500);
  }

  return NextResponse.json({ orgId: org.id }, { status: 200 });
}
