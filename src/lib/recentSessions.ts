export type RecentSession = { id: string; lastOpenedAt: number };

const KEY = "ai_session_notes_recent_sessions_v1";
const MAX = 25;

function safeParse(json: string | null): RecentSession[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.id === "string" && typeof x.lastOpenedAt === "number")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function getRecentSessions(): RecentSession[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY));
}

export function rememberSession(id: string): void {
  if (typeof window === "undefined") return;
  const trimmed = (id ?? "").trim();
  if (!trimmed) return;

  const current = getRecentSessions();
  const now = Date.now();

  const next: RecentSession[] = [
    { id: trimmed, lastOpenedAt: now },
    ...current.filter((s) => s.id !== trimmed),
  ].slice(0, MAX);

  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearRecentSessions(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
