"use client";

import { useState, useRef, useEffect } from "react";
import { useSessionJob } from "./SessionJobContext";

type Props = { sessionId: string };

const FOCUS_OPTIONS = ["Risk Assessment", "Treatment Progress", "Key Themes", "Session Summary"];

function DropdownButton({ label, options, value, onChange }: {
  label?: string;
  options: string[];
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const display = label ? (value ? `${label}: ${value}` : label) : (value ?? options[0]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {display}
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 min-w-[160px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange?.(opt); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIAnalysisViewer({ sessionId }: Props) {
  const { jobId, job } = useSessionJob();
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState("Risk Assessment");

  useEffect(() => {
    if (!jobId || !job) return;
    // Draft is available after draft stage completes (progress >= 80)
    if (job.status !== "complete" && job.progress < 80) {
      return;
    }
    // Only fetch once when threshold is reached
    if (draft !== "") return;

    const fetchDraft = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/jobs/${jobId}/draft`, {
          credentials: "include",
        });
        if (response.ok) {
          const text = await response.text();
          setDraft(text);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    void fetchDraft();
  }, [jobId, job, draft]);

  const isReady = job && (job.status === "complete" || job.progress >= 80);
  const content = isReady ? draft : "Waiting for AI analysis...";

  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[260px]">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">AI Analysis</h3>
        <div className="flex items-center gap-2">
          <DropdownButton label="Focus" value={focus} options={FOCUS_OPTIONS} onChange={setFocus} />
          <DropdownButton label="Export" options={["Copy Text", "Download .txt", "Download .pdf"]} />
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
        )}
      </div>
    </section>
  );
}
