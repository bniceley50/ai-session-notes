import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { requireDualAuth } from "@/lib/api/requireDualAuth";
import { isProduction } from "@/lib/config";
import { loadNote, saveNote, type NoteType } from "@/lib/supabase/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase session_id column is UUID — reject non-UUID values early */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_NOTE_TYPES = [
  "soap",
  "dap",
  "birp",
  "girp",
  "intake",
  "progress",
  "freeform",
] as const;

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

/**
 * GET /api/sessions/{sessionId}/notes?type=soap
 * Load the most recent note for this session + note type.
 * Auth: dual-auth (app JWT + Supabase session consistency check).
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId: sessionIdParam } = await context.params;

  // ── Auth: dual-auth (app JWT + Supabase session when available) ──
  const auth = await requireDualAuth(request, sessionIdParam, {
    requireSupabaseSession: isProduction(),
  });
  if (!auth.ok) return auth.response;

  const { sessionId, practiceId, supabaseClient } = auth;

  // If sessionId isn't a valid UUID, no notes can exist yet — return empty
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ content: "" }, { status: 200 });
  }

  // Parse noteType from query string
  const { searchParams } = new URL(request.url);
  const noteType = searchParams.get("type") as NoteType | null;
  if (!noteType || !VALID_NOTE_TYPES.includes(noteType as (typeof VALID_NOTE_TYPES)[number])) {
    return jsonError(400, "BAD_REQUEST", "Valid note type required (soap, dap, birp, girp, intake, progress, freeform)");
  }

  // practiceId flows from authenticated session — not from client input
  const orgId = practiceId;

  try {
    const note = await loadNote(sessionId, orgId, noteType, supabaseClient);

    if (!note) {
      return NextResponse.json({ content: "" }, { status: 200 });
    }

    return NextResponse.json({
      id: note.id,
      content: note.content,
      noteType: note.note_type,
      createdAt: note.created_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load note";
    return jsonError(500, "INTERNAL", message);
  }
}

/**
 * POST /api/sessions/{sessionId}/notes
 * Save (upsert) a note for this session.
 * Auth: dual-auth (app JWT + Supabase session consistency check).
 * Body: { type: "soap" | "dap" | "birp" | "freeform", content: string }
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId: sessionIdParam } = await context.params;

  // ── Auth: dual-auth (app JWT + Supabase session when available) ──
  const auth = await requireDualAuth(request, sessionIdParam, {
    requireSupabaseSession: isProduction(),
  });
  if (!auth.ok) return auth.response;

  const { sessionId, userId, practiceId, supabaseClient } = auth;

  // Reject non-UUID sessionIds early (Supabase column is UUID type)
  if (!UUID_RE.test(sessionId)) {
    return jsonError(400, "BAD_REQUEST", "sessionId must be a valid UUID");
  }

  // Parse request body
  let payload: { type?: unknown; content?: unknown } = {};
  try {
    payload = (await request.json()) as { type?: unknown; content?: unknown };
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const noteType = payload.type as NoteType | undefined;
  const content = typeof payload.content === "string" ? payload.content : undefined;

  if (!noteType || !VALID_NOTE_TYPES.includes(noteType as (typeof VALID_NOTE_TYPES)[number])) {
    return jsonError(400, "BAD_REQUEST", "Valid note type required (soap, dap, birp, girp, intake, progress, freeform)");
  }

  if (content === undefined) {
    return jsonError(400, "BAD_REQUEST", "content required");
  }

  // practiceId flows from authenticated session — not from client input
  const orgId = practiceId;

  try {
    const note = await saveNote(sessionId, orgId, noteType, content, supabaseClient, userId);

    return NextResponse.json({
      id: note.id,
      content: note.content,
      noteType: note.note_type,
      createdAt: note.created_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save note";
    return jsonError(500, "INTERNAL", message);
  }
}
