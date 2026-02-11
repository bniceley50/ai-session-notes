"use client";

import { useState, useRef, useEffect } from "react";
import { useSessionJob } from "./SessionJobContext";
import { ProgressBar } from "./ProgressBar";
import { DropdownButton } from "@/components/ui/DropdownButton";
import { jsPDF } from "jspdf";
import type { ClinicalNoteType } from "@/lib/jobs/claude";

type Props = { sessionId: string };

const NOTE_TYPE_OPTIONS: { value: ClinicalNoteType; label: string }[] = [
  { value: "soap", label: "SOAP Note" },
  { value: "dap", label: "DAP Note" },
  { value: "birp", label: "BIRP Note" },
  { value: "girp", label: "GIRP Note" },
  { value: "intake", label: "Intake/Assessment" },
  { value: "progress", label: "Progress Note" },
];

type CreateJobResponse = {
  jobId: string;
  sessionId: string;
  statusUrl: string;
};

type AnalysisJob = {
  status: string;
  stage: string;
  progress: number;
  errorMessage?: string | null;
};

const ANALYSIS_POLL_MS = 2000;

export function AIAnalysisViewer({ sessionId }: Props) {
  // Transcription job from shared context (tells us when transcript is ready)
  const { jobId: transcribeJobId, job: transcribeJob, audioArtifactId, transferToNotes, cancelJob } = useSessionJob();

  // This component's own analysis job state (separate from transcription)
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisJob, setAnalysisJob] = useState<AnalysisJob | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [selectedNoteType, setSelectedNoteType] = useState<ClinicalNoteType>("soap");
  const [transferred, setTransferred] = useState(false);
  const analysisPollRef = useRef<number | null>(null);

  const stopAnalysisPolling = () => {
    if (analysisPollRef.current !== null) {
      window.clearInterval(analysisPollRef.current);
      analysisPollRef.current = null;
    }
  };

  const cancelAnalysisJob = async () => {
    const id = analysisJobId;
    stopAnalysisPolling();
    setAnalysisJobId(null);
    setAnalysisJob(null);
    setDraft("");
    setStartError("");
    if (id) {
      try {
        await fetch(`/api/jobs/${id}`, { method: "DELETE", credentials: "include" });
      } catch { /* best-effort */ }
    }
  };

  useEffect(() => {
    return () => { stopAnalysisPolling(); };
  }, []);

  // Poll analysis job status
  const startAnalysisPolling = (url: string) => {
    stopAnalysisPolling();
    const poll = async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) { stopAnalysisPolling(); return; }
        const data = (await res.json()) as AnalysisJob;
        setAnalysisJob(data);
        if (data.status === "complete" || data.status === "failed" || data.status === "deleted") {
          stopAnalysisPolling();
        }
      } catch { stopAnalysisPolling(); }
    };
    void poll();
    analysisPollRef.current = window.setInterval(() => { void poll(); }, ANALYSIS_POLL_MS);
  };

  // Fetch draft once analysis job reaches threshold
  useEffect(() => {
    if (!analysisJobId || !analysisJob) return;
    if (analysisJob.status !== "complete" && analysisJob.progress < 80) return;
    if (draft !== "") return;

    const fetchDraft = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/jobs/${analysisJobId}/draft`, { credentials: "include" });
        if (response.ok) {
          const text = await response.text();
          setDraft(text);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    void fetchDraft();
  }, [analysisJobId, analysisJob, draft]);

  // Reset when a new transcription starts
  useEffect(() => {
    setAnalysisJobId(null);
    setAnalysisJob(null);
    setDraft("");
    setStartError("");
    setTransferred(false);
    stopAnalysisPolling();
  }, [transcribeJobId]);

  const handleGenerateNote = async () => {
    if (!audioArtifactId) {
      setStartError("No audio uploaded yet.");
      return;
    }
    setStarting(true);
    setStartError("");
    setTransferred(false);
    try {
      const response = await fetch("/api/jobs/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, audioArtifactId, mode: "analyze", noteType: selectedNoteType }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("Analysis job creation failed:", response.status, text);
        throw new Error(`Analysis failed (${response.status})`);
      }
      const jobData = (await response.json()) as CreateJobResponse;
      setAnalysisJobId(jobData.jobId);
      startAnalysisPolling(jobData.statusUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start analysis";
      setStartError(msg);
    } finally {
      setStarting(false);
    }
  };

  const handleTransferToNotes = () => {
    if (draft) {
      transferToNotes(draft, selectedNoteType);
      setTransferred(true);
    }
  };

  // Transcript is ready when the shared transcribe job is complete
  const transcriptFailed = transcribeJob?.status === "failed";
  const transcriptReady = transcribeJob && (transcribeJob.status === "complete" || transcribeJob.progress >= 40);
  // Analysis states
  const analysisFailed = analysisJob?.status === "failed";
  const analysisReady = analysisJob && (analysisJob.status === "complete" || analysisJob.progress >= 80);
  const analysisRunning = analysisJobId && !analysisReady && !analysisFailed;

  const selectedLabel = NOTE_TYPE_OPTIONS.find((o) => o.value === selectedNoteType)?.label ?? "Note";

  const handleExport = (option: string) => {
    if (!draft || draft === "") {
      alert("No content available to export yet.");
      return;
    }

    switch (option) {
      case "Copy Text":
        navigator.clipboard.writeText(draft)
          .then(() => alert("Copied to clipboard!"))
          .catch(() => alert("Failed to copy to clipboard."));
        break;

      case "Download .txt": {
        const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${selectedNoteType}-note-${sessionId}-${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        break;
      }

      case "Download .pdf": {
        try {
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const margins = 20;
          const maxWidth = pageWidth - margins * 2;
          const lineHeight = 6;
          let currentY = margins;

          // Split text into lines that fit the page width
          const lines = doc.splitTextToSize(draft, maxWidth);

          doc.setFontSize(10);

          // Add lines with pagination
          for (let i = 0; i < lines.length; i++) {
            // Check if we need a new page
            if (currentY + lineHeight > pageHeight - margins) {
              doc.addPage();
              currentY = margins;
            }

            doc.text(lines[i], margins, currentY);
            currentY += lineHeight;
          }

          doc.save(`${selectedNoteType}-note-${sessionId}-${new Date().toISOString().split("T")[0]}.pdf`);
        } catch (error) {
          alert("Failed to generate PDF.");
        }
        break;
      }
    }
  };

  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[260px]">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">AI Analysis</h3>
        <div className="flex items-center gap-2">
          {analysisReady && draft && (
            <button
              type="button"
              onClick={handleTransferToNotes}
              disabled={transferred}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition disabled:opacity-50"
              title="Copy AI draft into Structured Notes below"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              {transferred ? "Transferred!" : "Transfer to Notes"}
            </button>
          )}
          <DropdownButton label="Export" options={["Copy Text", "Download .txt", "Download .pdf"]} onChange={handleExport} />
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : analysisFailed ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-red-600">Note generation failed</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[260px] text-center">
              {analysisJob?.errorMessage ?? "Unknown error"}
            </p>
            <button
              type="button"
              onClick={() => void cancelAnalysisJob()}
              className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold"
            >
              Dismiss &amp; retry
            </button>
          </div>
        ) : analysisReady && draft ? (
          <pre className="whitespace-pre-wrap font-sans">{draft}</pre>
        ) : analysisRunning ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ProgressBar
              progress={analysisJob?.progress ?? 0}
              stage={analysisJob?.stage ?? "draft"}
              label={`Generating ${selectedLabel}`}
              indeterminate={!analysisJob || analysisJob.progress < 80}
            />
            <button
              type="button"
              onClick={() => void cancelAnalysisJob()}
              className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition mt-1"
            >
              Cancel
            </button>
          </div>
        ) : transcriptFailed ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-red-600">Transcription failed</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[260px] text-center">
              {transcribeJob?.errorMessage ?? "Unknown error"}
            </p>
          </div>
        ) : transcriptReady && !analysisJobId ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm text-slate-500">Transcript ready. Choose a note type and generate.</p>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Note Type:</label>
              <select
                value={selectedNoteType}
                onChange={(e) => setSelectedNoteType(e.target.value as ClinicalNoteType)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {NOTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleGenerateNote}
              disabled={starting}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
            >
              {starting ? "Starting..." : `Generate ${selectedLabel}`}
            </button>
            {startError && <p className="text-sm text-red-600">{startError}</p>}
          </div>
        ) : transcribeJobId && !transcriptReady ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ProgressBar
              progress={transcribeJob?.progress ?? 0}
              stage={transcribeJob?.stage ?? "transcribe"}
              label="Receiving transcript"
              indeterminate={!transcribeJob || transcribeJob.progress < 40}
              subtitle=""
            />
            <button
              type="button"
              onClick={() => void cancelJob()}
              className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition mt-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500">Upload audio to get started.</p>
          </div>
        )}
      </div>
    </section>
  );
}
