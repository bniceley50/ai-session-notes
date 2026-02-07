"use client";

import { useState } from "react";

type Props = { sessionId: string };

const TOOLBAR = ["Bold", "Italic", "Underline", "Bullet List", "Numbered List", "Undo", "Redo"];

export function NoteEditor({ sessionId }: Props) {
  const [note, setNote] = useState("Draft session note goes here. Highlight key findings and next steps.");

  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[240px]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Notes</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Session ID: {sessionId}</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-200">
        {TOOLBAR.map((label) => (
          <button
            key={label}
            type="button"
            className="rounded border border-slate-200 dark:border-slate-800 px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        className="flex-1 min-h-[160px] w-full resize-none rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-inner"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </section>
  );
}
