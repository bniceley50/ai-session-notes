import type { ReactNode } from "react";

type Insight = { title: string; detail: string };

const mockInsights: Insight[] = [
  { title: "Themes", detail: "Work stress and evening rumination are primary anxiety triggers." },
  { title: "Next Session", detail: "Introduce a 10-minute nightly wind-down and brief journaling." },
  { title: "Risk", detail: "No acute risk indicators reported; continue monitoring sleep pattern." },
];

export function AIAnalysisViewer({ sessionId }: { sessionId: string }) {
  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[260px]">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">AI Analysis</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Session ID: {sessionId}</p>
        </div>
      </header>
      <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-100">
        {mockInsights.map((insight, idx) => (
          <li key={idx} className="rounded-lg bg-slate-50 dark:bg-slate-900/40 px-3 py-2 ring-1 ring-slate-200 dark:ring-slate-800">
            <p className="font-semibold text-slate-900 dark:text-slate-50">{insight.title}</p>
            <p className="text-slate-700 dark:text-slate-300 text-sm">{insight.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
