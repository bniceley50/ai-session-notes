"use client";

import { useMemo, useState } from "react";
import type { SessionWithDetails } from "@/lib/sessions/types";

type SessionDetailProps = {
  session: SessionWithDetails;
};

export default function SessionDetail({ session }: SessionDetailProps) {
  const transcriptContent = session.transcript?.content || "No transcript available yet.";
  const initialNote = session.note?.content || "";
  const [note, setNote] = useState(initialNote);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const wordCount = useMemo(() => {
    const trimmed = note.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(w => w.length > 0).length;
  }, [note]);

  const transcriptWordCount = useMemo(() => {
    const trimmed = transcriptContent.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(w => w.length > 0).length;
  }, [transcriptContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  };

  const handleExport = () => {
    const blob = new Blob([note], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `session-${session.id}-note.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Transcript</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            {transcriptWordCount} words
          </span>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">
          {transcriptContent}
        </p>
      </section>

      <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Note draft</h2>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              {wordCount} words
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-slate-800"
            >
              {copyState === "copied" ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Export
            </button>
          </div>
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mt-4 min-h-[320px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 focus:border-slate-400 focus:outline-none"
        />
        <p className="mt-3 text-xs text-slate-500">
          Edit the draft note, then copy or export it to your charting system.
        </p>
      </section>
    </div>
  );
}
