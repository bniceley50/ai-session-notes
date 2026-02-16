import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { safePathSegment } from "@/lib/jobs/artifacts";
import { readJobIndex } from "@/lib/jobs/status";
import { readSessionOwnership } from "@/lib/sessions/ownership";

/**
 * Authenticate the caller and verify they own the session that
 * contains the given job.
 *
 * Returns the validated `jobId`, `sessionId`, and `practiceId` on
 * success, or a ready-to-return `Response` on failure.
 *
 * Error semantics (don't leak existence):
 *   - 401 → caller has no valid session cookie
 *   - 404 → job not found OR caller doesn't own it
 */
export async function requireJobOwner(
  request: Request,
  jobIdParam: string,
): Promise<
  | { ok: true; jobId: string; sessionId: string; practiceId: string }
  | { ok: false; response: Response }
> {
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

  // ── 2. Validate jobId format ───────────────────────────────────
  const jobId = typeof jobIdParam === "string" ? jobIdParam.trim() : "";
  if (!jobId) {
    return {
      ok: false,
      response: jsonError(400, "BAD_REQUEST", "jobId required."),
    };
  }

  try {
    safePathSegment(jobId);
  } catch {
    return {
      ok: false,
      response: jsonError(400, "BAD_REQUEST", "Invalid jobId."),
    };
  }

  // ── 3. Look up job → sessionId ─────────────────────────────────
  const index = await readJobIndex(jobId);
  if (!index) {
    return {
      ok: false,
      response: jsonError(404, "NOT_FOUND", "Job not found or not accessible."),
    };
  }

  // ── 4. Verify session ownership ────────────────────────────────
  const ownership = await readSessionOwnership(index.sessionId);
  if (!ownership || ownership.ownerUserId !== session.sub) {
    return {
      ok: false,
      response: jsonError(404, "NOT_FOUND", "Job not found or not accessible."),
    };
  }

  return { ok: true, jobId, sessionId: index.sessionId, practiceId: session.practiceId };
}

