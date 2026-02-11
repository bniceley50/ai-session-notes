/**
 * Notes service - server-only, uses service role key
 *
 * WARNING: This uses service role (bypasses RLS). Tenant isolation is enforced
 * manually via org_id checks. This is a temporary bridge until Cognito tokens
 * are wired to Supabase (Step 2).
 *
 * Security model:
 * - API route validates session cookie (readSessionFromCookieHeader)
 * - practiceId from session → org_id (assumes direct mapping for MVP)
 * - This service enforces org_id in all queries
 * - Upgrade to real RLS in Step 2 when user tokens flow to Supabase
 */

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NoteType = "soap" | "dap" | "birp" | "girp" | "intake" | "progress" | "freeform";

export type Note = {
  id: string;
  org_id: string;
  session_id: string;
  note_type: NoteType;
  content: string;
  created_at: string;
};

/**
 * Load the most recent note for a session + note type
 * Returns null if no note exists yet
 */
export async function loadNote(
  sessionId: string,
  orgId: string,
  noteType: NoteType
): Promise<Note | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("session_id", sessionId)
    .eq("org_id", orgId)
    .eq("note_type", noteType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load note: ${error.message}`);
  }

  return data as Note | null;
}

/**
 * Ensure the org and session rows exist in Supabase before inserting a note.
 *
 * The notes table has FK constraints:
 *   notes.org_id      → orgs.id
 *   (session_id, org_id) → sessions(id, org_id)
 *
 * During the MVP flow the session row may not yet exist in Supabase when the
 * NoteEditor autosave fires (it can race ahead of the audio-upload endpoint
 * that normally creates the session row). This helper does idempotent upserts
 * so the FK is always satisfied.
 */
async function ensureOrgAndSession(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
  orgId: string
): Promise<void> {
  // 1. Ensure org exists (idempotent)
  await supabase
    .from("orgs")
    .upsert({ id: orgId, name: "Default Org" }, { onConflict: "id" })
    .select()
    .single();

  // 2. Ensure session exists (idempotent)
  await supabase
    .from("sessions")
    .upsert(
      {
        id: sessionId,
        org_id: orgId,
        label: "New Session",
        status: "active",
      },
      { onConflict: "id" }
    )
    .select()
    .single();
}

/**
 * Save (upsert) a note for a session + note type
 * Last-write-wins semantics (no conflict resolution)
 *
 * Uses manual 2-query pattern to ensure org_id is included in conflict check.
 * CRITICAL: We cannot use Supabase's onConflict because it doesn't allow
 * org_id in the conflict target (not part of the unique constraint), which
 * would allow cross-org clobbering if sessionIds collide.
 */
export async function saveNote(
  sessionId: string,
  orgId: string,
  noteType: NoteType,
  content: string
): Promise<Note> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Ensure org + session rows exist so FK constraints are satisfied.
  // This is a no-op when rows already exist (upsert with onConflict).
  await ensureOrgAndSession(supabase, sessionId, orgId);

  // Step 1: Check if note exists for this org + session + type
  const { data: existing } = await supabase
    .from("notes")
    .select("id")
    .eq("session_id", sessionId)
    .eq("org_id", orgId)
    .eq("note_type", noteType)
    .maybeSingle();

  if (existing) {
    // Step 2a: Update existing note
    const { data, error } = await supabase
      .from("notes")
      .update({ content })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update note: ${error.message}`);
    }

    return data as Note;
  } else {
    // Step 2b: Insert new note
    const { data, error } = await supabase
      .from("notes")
      .insert({
        session_id: sessionId,
        org_id: orgId,
        note_type: noteType,
        content,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert note: ${error.message}`);
    }

    return data as Note;
  }
}

/**
 * Delete a note (for Clear button)
 */
export async function deleteNote(
  sessionId: string,
  orgId: string,
  noteType: NoteType
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration");
  }

  const supabase = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("session_id", sessionId)
    .eq("org_id", orgId)
    .eq("note_type", noteType);

  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`);
  }
}
