"use client";

import { useState, useRef, useEffect } from "react";
import { useSessionJob } from "./SessionJobContext";

type Props = { sessionId: string };

function DropdownButton({ label, options, onChange }: {
  label: string;
  options: string[];
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {label}
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 min-w-[120px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
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

export function TranscriptViewer({ sessionId }: Props) {
  const { jobId, job } = useSessionJob();
  const [transcript, setTranscript] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Reset content when job changes (prevents stale content from previous job)
  useEffect(() => {
    setTranscript("");
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !job) return;
    // Transcript is available after transcribe stage completes (progress >= 40)
    if (job.status !== "complete" && job.progress < 40) {
      return;
    }
    // Only fetch once when threshold is reached
    if (transcript !== "") return;

    const fetchTranscript = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/jobs/${jobId}/transcript`, {
          credentials: "include",
        });
        if (response.ok) {
          const text = await response.text();
          setTranscript(text);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    void fetchTranscript();
  }, [jobId, job, transcript]);

  const isReady = job && (job.status === "complete" || job.progress >= 40);
  const content = isReady ? transcript : "Waiting for transcription...";

  const handleExport = (option: string) => {
    if (!transcript || transcript === "") {
      alert("No transcript available to export yet.");
      return;
    }

    switch (option) {
      case "Copy Text":
        navigator.clipboard.writeText(transcript)
          .then(() => alert("Copied to clipboard!"))
          .catch(() => alert("Failed to copy to clipboard."));
        break;

      case "Download .txt": {
        const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `transcript-${sessionId}-${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        break;
      }

      case "Download .docx":
        alert("Word document export coming soon!");
        break;
    }
  };

  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[260px]">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Transcript</h3>
        <DropdownButton label="Export" options={["Copy Text", "Download .txt", "Download .docx"]} onChange={handleExport} />
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
        )}
      </div>
    </section>
  );
}
