"use client";

import { useRouter } from "next/navigation";

type SavedSession = {
  id: string;
  timestamp: string; // ISO timestamp
  duration?: number; // in minutes
  daysUntilExpiration: number;
};

type Props = {
  currentSessionId?: string;
};

// Mock data - in real app this would come from API/database
const MOCK_SESSIONS: SavedSession[] = [
  { id: "sess-001", timestamp: "2026-02-07T14:23:00", duration: 32, daysUntilExpiration: 28 },
  { id: "sess-002", timestamp: "2026-02-05T10:15:00", duration: 45, daysUntilExpiration: 26 },
  { id: "sess-003", timestamp: "2026-02-03T16:30:00", duration: 28, daysUntilExpiration: 24 },
  { id: "sess-004", timestamp: "2026-01-31T09:45:00", duration: 38, daysUntilExpiration: 21 },
  { id: "sess-005", timestamp: "2026-01-28T14:00:00", duration: 41, daysUntilExpiration: 18 },
  { id: "sess-006", timestamp: "2026-01-25T11:20:00", duration: 35, daysUntilExpiration: 15 },
  { id: "sess-007", timestamp: "2026-01-20T15:30:00", duration: 29, daysUntilExpiration: 10 },
  { id: "sess-008", timestamp: "2026-01-15T13:45:00", duration: 42, daysUntilExpiration: 5 },
  { id: "sess-009", timestamp: "2026-01-12T10:00:00", duration: 36, daysUntilExpiration: 2 },
];

function formatSessionName(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `Session – ${year}-${month}-${day} ${hours}:${minutes}`;
}

function getRetentionColor(daysRemaining: number): string {
  if (daysRemaining <= 3) return "text-amber-400";
  return "text-gray-400";
}

export function SessionHistoryStrip({ currentSessionId }: Props) {
  const router = useRouter();

  const handleSessionClick = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  return (
    <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">
        Recent Sessions
      </h2>

      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
        {MOCK_SESSIONS.map((session) => {
          const isActive = session.id === currentSessionId;
          return (
            <button
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`w-full text-left px-4 py-2 rounded-lg transition cursor-pointer flex items-center justify-between group ${
                isActive
                  ? "bg-indigo-50 border-l-2 border-indigo-500"
                  : "hover:bg-gray-50 border-l-2 border-transparent"
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm font-medium text-slate-900">
                  {formatSessionName(session.timestamp)}
                </span>
                {session.duration && (
                  <span className="text-xs text-slate-500">
                    {session.duration} min
                  </span>
                )}
              </div>

              <span
                className={`text-xs ${getRetentionColor(session.daysUntilExpiration)} transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                Expires in {session.daysUntilExpiration} days
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

