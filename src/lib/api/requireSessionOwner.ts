import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { safePathSegment } from "@/lib/jobs/artifacts";
import {
  ensureSessionOwnership,
  readSessionOwnership,
} from "@/lib/sessions/ownership";

export type SessionOwnerOptions = {
  /**
   * When true, creates an ownership record if none exists
   * (used by the audio-upload route for first-touch session creation).
   * Default: false (read-only check).
   */
  allowAutocreate?: boolean;
};

/**
 * Authenticate the caller and verify they own the given session.
 *
 * Mirrors `requireJobOwner` but for session-scoped routes
 * (audio upload, audio download, notes, job creation).
 *
 * Returns the validated `sessionId`, `userId`, and `practiceId`
 * on success, or a ready-to-return `Response` on failure.
 *
 * Error semantics (don't leak existence):
 *   - 401 → caller has no valid session cookie
 *   - 400 → sessionId is missing or malformed
 *   - 404 → session not found OR caller doesn't own it
 */
export async function requireSessionOwner(
  request: Request,
  sessionIdParam: string,
  options: SessionOwnerOptions = {},
): Promise<
  | { ok: true; sessionId: string; userId: string; practiceId: string }
  | { ok: false; response: Response }
> {
  const { allowAutocreate = false } = options;

  // ── 1. Authenticate ────────────────────────────────────────────
  const session = await readSessionFromCookieHeader(
    request.headers.get("cookie"),
  );
  if (!session) {
    return {
      ok: false,
      response: jsonError(401, "UNAUTHENTICATED", "Please sign in to continue."),
    };
  }

  // ── 2. Validate sessionId format ───────────────────────────────
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam.trim() : "";
  if (!sessionId) {
    return {
      ok: false,
      response: jsonError(400, "BAD_REQUEST", "sessionId required."),
    };
  }

  try {
    safePathSegment(sessionId);
  } catch {
    return {
      ok: false,
      response: jsonError(400, "BAD_REQUEST", "Invalid sessionId."),
    };
  }

  // ── 3. Verify session ownership ────────────────────────────────
  if (allowAutocreate) {
    const ownership = await ensureSessionOwnership(
      sessionId,
      session.sub,
      true,
      session.practiceId,
    );
    if (!ownership) {
      return {
        ok: false,
        response: jsonError(
          404,
          "NOT_FOUND",
          "Session not found or not accessible.",
        ),
      };
    }
  } else {
    const ownership = await readSessionOwnership(sessionId);
    if (!ownership || ownership.ownerUserId !== session.sub) {
      return {
        ok: false,
        response: jsonError(
          404,
          "NOT_FOUND",
          "Session not found or not accessible.",
        ),
      };
    }
  }

  return {
    ok: true,
    sessionId,
    userId: session.sub,
    practiceId: session.practiceId,
  };
}
