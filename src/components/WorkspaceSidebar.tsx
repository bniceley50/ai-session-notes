"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clearRecentSessions,
  getRecentSessions,
  rememberSession,
  type RecentSession,
} from "@/lib/recentSessions";

type Props = {
  activeSessionId?: string;
};

function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

export default function WorkspaceSidebar({ activeSessionId }: Props) {
  const [items, setItems] = useState<RecentSession[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(getRecentSessions());

    // keep it fresh if user navigates around
    const onFocus = () => setItems(getRecentSessions());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const id = (activeSessionId ?? "").trim();
    if (!id) return;
    rememberSession(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(getRecentSessions());
  }, [activeSessionId]);

  const hasItems = items.length > 0;

  const active = useMemo(() => (activeSessionId ?? "").trim(), [activeSessionId]);

  return (
    <aside className="h-full w-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Sessions</h2>

          <button
            className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            onClick={() => {
              clearRecentSessions();
              setItems([]);
            }}
            disabled={!hasItems}
            title="Clear recent sessions"
          >
            Clear
          </button>
        </div>

        {!hasItems ? (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            No recent sessions yet. Open a session once and it’ll show here.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {items.map((s) => {
              const isActive = active && s.id === active;
              return (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${encodeURIComponent(s.id)}`}
                    className={[
                      "block rounded px-2 py-1 text-sm",
                      isActive
                        ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/60",
                    ].join(" ")}
                    title={formatWhen(s.lastOpenedAt)}
                  >
                    <div className="truncate">{s.id}</div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-500">
                      {formatWhen(s.lastOpenedAt)}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

