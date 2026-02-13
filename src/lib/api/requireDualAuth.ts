import { jsonError } from "@/lib/api/errors";
import { requireSessionOwner, type SessionOwnerOptions } from "@/lib/api/requireSessionOwner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DualAuthResult =
  | {
      ok: true;
      sessionId: string;
      userId: string;
      practiceId: string;
      /** The user-scoped Supabase client (carries Supabase auth session → RLS active). Null when no Supabase session. */
      supabaseClient: Awaited<ReturnType<typeof createSupabaseServerClient>> | null;
    }
  | { ok: false; response: Response };

/**
 * Dual-auth guard: app JWT + Supabase session consistency check.
 *
 * 1. Runs `requireSessionOwner` (app JWT cookie → ownership check).
 * 2. Reads the Supabase auth session via `createSupabaseServerClient`.
 * 3. If a Supabase session exists, asserts its user ID matches the app JWT's `sub`.
 *    Mismatch → 403 (identity conflict).
 * 4. Returns the user-scoped Supabase client when available (RLS active),
 *    or null when no Supabase session (dev-login flow).
 *
 * Routes that need RLS-scoped Supabase access (notes CRUD) should use this
 * instead of plain `requireSessionOwner`.
 */
export type DualAuthOptions = SessionOwnerOptions & {
  /**
   * When true, missing/invalid Supabase auth session becomes a hard failure.
   * Use this for production-only paths that must run under RLS identity.
   */
  requireSupabaseSession?: boolean;
  /** @internal Test-only override for the Supabase server client factory. */
  _supabaseFactory?: () => Promise<SupabaseClient>;
};

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function requireDualAuth(
  request: Request,
  sessionIdParam: string,
  options: DualAuthOptions = {},
): Promise<DualAuthResult> {
  const {
    _supabaseFactory,
    requireSupabaseSession = false,
    ...ownerOpts
  } = options;

  // ── 1. App JWT auth (ownership check) ───────────────────────────
  const auth = await requireSessionOwner(request, sessionIdParam, ownerOpts);
  if (!auth.ok) return auth;

  // ── 2. Read Supabase auth session ───────────────────────────────
  let supabaseClient: SupabaseClient | null = null;
  const factory = _supabaseFactory ?? createSupabaseServerClient;

  try {
    const client = await factory();
    const { data: { user }, error } = await client.auth.getUser();

    if (!error && user) {
      // ── 3. Consistency check: app JWT user must match Supabase user ──
      if (user.id !== auth.userId) {
        return {
          ok: false,
          response: jsonError(
            403,
            "FORBIDDEN",
            "Session identity conflict. Please sign out and sign in again.",
          ),
        };
      }
      supabaseClient = client;
    } else if (requireSupabaseSession) {
      return {
        ok: false,
        response: jsonError(
          401,
          "UNAUTHENTICATED",
          "Supabase session required. Please sign in again.",
        ),
      };
    }
    // No Supabase session (dev-login flow) → supabaseClient stays null
  } catch {
    if (requireSupabaseSession) {
      return {
        ok: false,
        response: jsonError(
          401,
          "UNAUTHENTICATED",
          "Supabase session required. Please sign in again.",
        ),
      };
    }
    // Supabase client creation failed (e.g. missing env vars in dev) → degrade gracefully
    supabaseClient = null;
  }

  return {
    ok: true,
    sessionId: auth.sessionId,
    userId: auth.userId,
    practiceId: auth.practiceId,
    supabaseClient,
  };
}
