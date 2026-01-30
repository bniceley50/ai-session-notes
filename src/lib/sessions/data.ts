import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DbSession, DbTranscript, DbNote, SessionWithDetails } from "./types";

export async function getSessionsByOrgId(orgId: string): Promise<DbSession[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const client = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await client
    .from("sessions")
    .select("id, org_id, label, status, created_by, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return data as DbSession[];
}

export async function getSessionWithDetails(
  sessionId: string,
  orgId: string
): Promise<SessionWithDetails | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const client = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: session, error: sessionError } = await client
    .from("sessions")
    .select("id, org_id, label, status, created_by, created_at")
    .eq("id", sessionId)
    .eq("org_id", orgId)
    .single();

  if (sessionError || !session) {
    return null;
  }

  const { data: transcripts } = await client
    .from("transcripts")
    .select("id, org_id, session_id, content, created_at")
    .eq("session_id", sessionId)
    .eq("org_id", orgId)
    .limit(1);

  const { data: notes } = await client
    .from("notes")
    .select("id, org_id, session_id, note_type, content, created_at")
    .eq("session_id", sessionId)
    .eq("org_id", orgId)
    .limit(1);

  return {
    ...session,
    transcript: transcripts?.[0] as DbTranscript | undefined,
    note: notes?.[0] as DbNote | undefined,
  } as SessionWithDetails;
}
