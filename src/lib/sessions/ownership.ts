import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT, safePathSegment } from "@/lib/jobs/artifacts";

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
  ownerUserId: string
): Promise<SessionOwnership> => {
  const createdAt = new Date().toISOString();
  const payload: SessionOwnership = { sessionId, ownerUserId, createdAt };
  await fs.mkdir(SESSION_INDEX_DIR, { recursive: true });
  await fs.writeFile(getSessionIndexPath(sessionId), JSON.stringify(payload, null, 2), "utf8");
  return payload;
};

export const ensureSessionOwnership = async (
  sessionId: string,
  ownerUserId: string,
  allowAutocreate: boolean
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
  return writeSessionOwnership(sessionId, ownerUserId);
};



