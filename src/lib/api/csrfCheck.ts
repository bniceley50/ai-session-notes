import { jsonError } from "@/lib/api/errors";

/** HTTP methods that never cause side-effects — always allowed. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Origins allowed to make state-changing requests.
 *
 * - Same-origin requests match dynamically via the request URL's origin.
 * - `capacitor://localhost` is the iOS companion app (Capacitor WebView).
 */
const EXTRA_ALLOWED_ORIGINS = new Set(["capacitor://localhost"]);

/**
 * CSRF guard — validates Origin/Referer on state-changing requests.
 *
 * Returns `null` when the request is allowed, or a `403 Response` when blocked.
 *
 * Pattern matches `enforceWindowRateLimit` (guard returns `Response | null`).
 */
export function csrfCheck(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null;

  // Determine the request's own origin for same-origin comparison.
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return jsonError(403, "CSRF_REJECTED", "Invalid request URL.");
  }

  // Try Origin header first; fall back to Referer.
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  let incomingOrigin: string | null = null;

  if (origin) {
    incomingOrigin = origin;
  } else if (referer) {
    try {
      incomingOrigin = new URL(referer).origin;
    } catch {
      // Malformed Referer → block.
      return jsonError(403, "CSRF_REJECTED", "Cross-origin request blocked.");
    }
  }

  if (!incomingOrigin) {
    return jsonError(403, "CSRF_REJECTED", "Cross-origin request blocked.");
  }

  if (incomingOrigin === requestOrigin) return null;
  if (EXTRA_ALLOWED_ORIGINS.has(incomingOrigin)) return null;

  return jsonError(403, "CSRF_REJECTED", "Cross-origin request blocked.");
}
