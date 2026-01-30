"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@/lib/sessions/mock";

import { useMemo, useState } from "react";
import type { Session } from "@/lib/sessions/mock";

type SessionDetailProps = {
  session: Session;
};

export default function SessionDetail({ session }: SessionDetailProps) {
  const [note, setNote] = useState(session.note);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const saveTimerRef = useRef<number | null>(null);

  const storageKey = useMemo(() => `asn:note:${session.id}`, [session.id]);

  // Load saved note (if any) when session changes
  useEffect(() => {
    // default from the session first
    setNote(session.note);

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null) {
        setNote(saved);
      }
    } catch {
      // ignore storage errors (privacy mode, blocked storage, etc.)
    }

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [session.id, session.note, storageKey]);

  // Autosave note to localStorage (debounced)
  useEffect(() => {
    try {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        try {
          const trimmed = note.trim();
          if (trimmed.length === 0) {
            window.localStorage.removeItem(storageKey);
          } else {
            window.localStorage.setItem(storageKey, note);
          }
        } catch {
          // ignore
        }
      }, 250);
    } catch {
      // ignore
    }
  }, [note, storageKey]);

  const wordCount = useMemo(() => {
    const trimmed = note.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [note]);

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
            {session.transcript.split(/\s+/).length} words
          </span>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">
          {session.transcript}
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
