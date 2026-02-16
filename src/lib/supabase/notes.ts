/**
 * Notes service - server-only
 *
 * Security model (PR2):
 * - Note CRUD uses a caller-provided Supabase client. When the caller passes
 *   a user-scoped client (from `createSupabaseServerClient`), RLS policies
 *   enforce tenant isolation automatically via `is_org_member(org_id)`.
 * - When no user-scoped client is available (dev-login flow), the caller
 *   passes the admin client and org_id WHERE clauses provide isolation.
 * - Bootstrap writes (ensureOrgAndSession) always use the admin client
 *   because the user may not yet be an org member (chicken-and-egg).
 */

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl, supabaseServiceRoleKey } from "@/lib/config";
import type { SupabaseClient } from "@supabase/supabase-js";

function requireAdminClient() {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!key) {
    throw new Error("Missing Supabase configuration");
  }
  return createSupabaseAdminClient(url, key);
}

export type NoteType = "soap" | "dap" | "birp" | "girp" | "intake" | "progress" | "freeform";

export type Note = {
  id: string;
  org_id: string;
  session_id: string;
  note_type: NoteType;
  content: string;
  created_at: string;
};

/** Context metadata for observability when resolveClient falls back to admin. */
type ResolveClientMeta = {
  sessionId?: string;
  caller?: string;
};

/** Module-level flag — warn at most once per process to avoid log spam. */
let _adminFallbackWarned = false;

/**
 * Reset the warn-once flag. Exported for testing only.
 * @internal
 */
export function _resetAdminFallbackWarning(): void {
  _adminFallbackWarned = false;
}

/**
 * Resolve the Supabase client to use for note CRUD.
 * Prefers a user-scoped client (RLS active) when provided;
 * falls back to the admin client.
 *
 * In production, logs a warning (once per process) when falling back
 * to admin — this bypasses RLS and should only happen in dev-login flow.
 */
function resolveClient(
  userClient: SupabaseClient | null | undefined,
  meta?: ResolveClientMeta,
): SupabaseClient {
  if (userClient) return userClient;

  if (process.env.NODE_ENV === "production" && !_adminFallbackWarned) {
    _adminFallbackWarned = true;
    console.warn("[notes] Admin client fallback used", {
      sessionId: meta?.sessionId,
      caller: meta?.caller,
    });
  }

  return requireAdminClient();
}

/**
 * Load the most recent note for a session + note type.
 * Returns null if no note exists yet.
 *
 * @param client - User-scoped Supabase client (RLS) or null (admin fallback).
 */
export async function loadNote(
  sessionId: string,
  orgId: string,
  noteType: NoteType,
  client?: SupabaseClient | null,
): Promise<Note | null> {
  const supabase = resolveClient(client, { sessionId, caller: "loadNote" });

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
 * ALWAYS uses admin client — the user may not yet be an org member,
 * so RLS would block the insert (chicken-and-egg for bootstrapping).
 *
 * The notes table has FK constraints:
 *   notes.org_id      → orgs.id
 *   (session_id, org_id) → sessions(id, org_id)
 */
async function ensureOrgAndSession(
  sessionId: string,
  orgId: string,
  userId?: string,
): Promise<void> {
  const admin = requireAdminClient();

  // 1. Ensure org exists (idempotent)
  await admin
    .from("orgs")
    .upsert({ id: orgId, name: "Default Org" }, { onConflict: "id" })
    .select()
    .single();

  // 2. Ensure session exists (idempotent), with created_by when available
  const sessionRow: Record<string, unknown> = {
    id: sessionId,
    org_id: orgId,
    label: "New Session",
    status: "active",
  };
  if (userId) {
    sessionRow.created_by = userId;
  }

  await admin
    .from("sessions")
    .upsert(sessionRow, { onConflict: "id" })
    .select()
    .single();

  // 3. Ensure profile exists so RLS is_org_member() succeeds for this user
  if (userId) {
    await admin
      .from("profiles")
      .upsert({ user_id: userId, org_id: orgId }, { onConflict: "user_id,org_id" })
      .select()
      .single();
  }
}

/**
 * Save (upsert) a note for a session + note type.
 * Last-write-wins semantics (no conflict resolution).
 *
 * Uses manual 2-query pattern to ensure org_id is included in conflict check.
 * CRITICAL: We cannot use Supabase's onConflict because it doesn't allow
 * org_id in the conflict target (not part of the unique constraint), which
 * would allow cross-org clobbering if sessionIds collide.
 *
 * @param client - User-scoped Supabase client (RLS) or null (admin fallback).
 * @param userId - Auth user ID, used for created_by and profile bootstrapping.
 */
export async function saveNote(
  sessionId: string,
  orgId: string,
  noteType: NoteType,
  content: string,
  client?: SupabaseClient | null,
  userId?: string,
): Promise<Note> {
  // Bootstrap uses admin client (chicken-and-egg: user may not be member yet)
  await ensureOrgAndSession(sessionId, orgId, userId);

  // Note CRUD uses the caller-provided client (user-scoped when available)
  const supabase = resolveClient(client, { sessionId, caller: "saveNote" });

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
 * Delete a note (for Clear button).
 *
 * @param client - User-scoped Supabase client (RLS) or null (admin fallback).
 */
export async function deleteNote(
  sessionId: string,
  orgId: string,
  noteType: NoteType,
  client?: SupabaseClient | null,
): Promise<void> {
  const supabase = resolveClient(client, { sessionId, caller: "deleteNote" });

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

