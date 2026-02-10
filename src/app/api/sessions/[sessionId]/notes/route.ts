import { NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { loadNote, saveNote, type NoteType } from "@/lib/supabase/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

/**
 * GET /api/sessions/{sessionId}/notes?type=soap
 * Load the most recent note for this session + note type
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  // 1. Verify authentication
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  // 2. Parse sessionId from URL
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError(400, "BAD_REQUEST", "sessionId required");
  }

  // 3. Parse noteType from query string
  const { searchParams } = new URL(request.url);
  const noteType = searchParams.get("type") as NoteType | null;
  if (!noteType || !["soap", "dap", "birp", "freeform"].includes(noteType)) {
    return jsonError(400, "BAD_REQUEST", "Valid note type required (soap, dap, birp, freeform)");
  }

  // 4. Map practiceId → orgId (MVP: direct mapping)
  const orgId = session.practiceId;

  // 5. Load note from Supabase
  try {
    const note = await loadNote(sessionId, orgId, noteType);

    if (!note) {
      // No note exists yet - return empty
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
 * Save (upsert) a note for this session
 * Body: { type: "soap" | "dap" | "birp" | "freeform", content: string }
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  // 1. Verify authentication
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  // 2. Parse sessionId from URL
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError(400, "BAD_REQUEST", "sessionId required");
  }

  // 3. Parse request body
  let payload: { type?: unknown; content?: unknown } = {};
  try {
    payload = (await request.json()) as { type?: unknown; content?: unknown };
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const noteType = payload.type as NoteType | undefined;
  const content = typeof payload.content === "string" ? payload.content : undefined;

  if (!noteType || !["soap", "dap", "birp", "freeform"].includes(noteType)) {
    return jsonError(400, "BAD_REQUEST", "Valid note type required (soap, dap, birp, freeform)");
  }

  if (content === undefined) {
    return jsonError(400, "BAD_REQUEST", "content required");
  }

  // 4. Map practiceId → orgId (MVP: direct mapping)
  const orgId = session.practiceId;

  // 5. Save note to Supabase
  try {
    const note = await saveNote(sessionId, orgId, noteType, content);

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
