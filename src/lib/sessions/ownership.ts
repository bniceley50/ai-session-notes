import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT, safePathSegment } from "@/lib/jobs/artifacts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SessionOwnership = {
  sessionId: string;
  ownerUserId: string;
  createdAt: string;
};

const SESSION_INDEX_DIR = path.resolve(ARTIFACTS_ROOT, "_index", "sessions");

const getSessionIndexPath = (sessionId: string): string =>
  path.resolve(SESSION_INDEX_DIR, `${safePathSegment(sessionId)}.json`);

const parseOwnership = (raw: string): SessionOwnership | null => {
  try {
    const data = JSON.parse(raw) as SessionOwnership;
    if (!data || typeof data !== "object") return null;
    if (typeof data.sessionId !== "string") return null;
    if (typeof data.ownerUserId !== "string") return null;
    if (typeof data.createdAt !== "string") return null;
    return data;
  } catch {
    return null;
  }
};

export const readSessionOwnership = async (
  sessionId: string
): Promise<SessionOwnership | null> => {
  try {
    const raw = await fs.readFile(getSessionIndexPath(sessionId), "utf8");
    return parseOwnership(raw);
  } catch {
    return null;
  }
};

export const writeSessionOwnership = async (
  sessionId: string,
  ownerUserId: string,
  orgId?: string
): Promise<SessionOwnership> => {
  const createdAt = new Date().toISOString();
  const payload: SessionOwnership = { sessionId, ownerUserId, createdAt };

  // Write to filesystem
  await fs.mkdir(SESSION_INDEX_DIR, { recursive: true });
  await fs.writeFile(getSessionIndexPath(sessionId), JSON.stringify(payload, null, 2), "utf8");

  // Also create in Supabase if orgId is provided
  if (orgId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabase = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

      // Try to insert the session (ignore if it already exists)
      try {
        await supabase
          .from("sessions")
          .insert({
            id: sessionId,
            org_id: orgId,
            label: "New Session",
            status: "active",
            // created_by is nullable, set to null since ownerUserId might not be a valid auth.users id
          })
          .select()
          .single();
      } catch {
        // Ignore errors - session might already exist
        // The filesystem record is the source of truth for ownership
      }
    }
  }

  return payload;
};

export const ensureSessionOwnership = async (
  sessionId: string,
  ownerUserId: string,
  allowAutocreate: boolean,
  orgId?: string
): Promise<SessionOwnership | null> => {
  if (!sessionId || !ownerUserId) return null;
  try {
    safePathSegment(sessionId);
  } catch {
    return null;
  }

  const existing = await readSessionOwnership(sessionId);
  if (existing) {
    return existing.ownerUserId === ownerUserId ? existing : null;
  }

  if (!allowAutocreate) return null;
  return writeSessionOwnership(sessionId, ownerUserId, orgId);
};



