"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";
import { useSessionJob } from "./SessionJobContext";
import { JobStatusChip } from "./JobStatusChip";
import { PanelHeader } from "./PanelHeader";
import { ProgressBar } from "./ProgressBar";
import { Button } from "@/components/ui/button";
import { DropdownButton } from "@/components/ui/DropdownButton";
import { jsPDF } from "jspdf";
import type { ClinicalNoteType } from "@/lib/jobs/claude";
import type { JobStage, JobStatus } from "@/lib/jobs/status";

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
  const { jobId: transcribeJobId, job: transcribeJob, audioArtifactId, transferToNotes, cancelJob, jobNotice, clearJobNotice } = useSessionJob();

  // This component's own analysis job state (separate from transcription)
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisJob, setAnalysisJob] = useState<AnalysisJob | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [selectedNoteType, setSelectedNoteType] = useState<ClinicalNoteType>("soap");
  const [transferState, setTransferState] = useState<"idle" | "success" | "error">("idle");
  const [transferError, setTransferError] = useState("");
  const analysisPollRef = useRef<number | null>(null);
  const transferTimerRef = useRef<number | null>(null);

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

  // Auto-clear transfer success state after 2 seconds
  useEffect(() => {
    if (transferState === "success") {
      transferTimerRef.current = window.setTimeout(() => {
        setTransferState("idle");
      }, 2000);
    }
    return () => {
      if (transferTimerRef.current !== null) {
        window.clearTimeout(transferTimerRef.current);
        transferTimerRef.current = null;
      }
    };
  }, [transferState]);

  // Reset when a new transcription starts
  useEffect(() => {
    setAnalysisJobId(null);
    setAnalysisJob(null);
    setDraft("");
    setStartError("");
    setTransferState("idle");
    setTransferError("");
    stopAnalysisPolling();
  }, [transcribeJobId]);

  const handleGenerateNote = async () => {
    if (!audioArtifactId) {
      setStartError("No audio uploaded yet.");
      return;
    }
    setStarting(true);
    setStartError("");
    setTransferState("idle");
    setTransferError("");
    clearJobNotice();
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
    if (!draft) return;
    try {
      transferToNotes(draft, selectedNoteType);
      setTransferState("success");
      setTransferError("");
    } catch (err) {
      setTransferState("error");
      setTransferError(err instanceof Error ? err.message : "Transfer failed");
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
      toast.warning("No content available to export yet.");
      return;
    }

    switch (option) {
      case "Copy Text":
        navigator.clipboard.writeText(draft)
          .then(() => toast.success("Copied to clipboard"))
          .catch(() => toast.error("Failed to copy to clipboard"));
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
          toast.error("Failed to generate PDF");
        }
        break;
      }
    }
  };

  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[260px]">
      <PanelHeader
        testId="panel-header-analysis"
        title="AI Analysis"
        status={
          analysisJob ? (
            <JobStatusChip status={analysisJob.status as JobStatus} stage={analysisJob.stage as JobStage} testId="status-chip-analysis" />
          ) : transcribeJob ? (
            <JobStatusChip status={transcribeJob.status} stage={transcribeJob.stage} testId="status-chip-analysis" />
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {analysisReady && draft && (
              <>
                <Button
                  data-testid="action-transfer-notes"
                  variant="outline"
                  size="xs"
                  onClick={handleTransferToNotes}
                  disabled={transferState === "success"}
                  className={
                    transferState === "success"
                      ? "border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  }
                  title="Copy AI draft into Structured Notes below"
                >
                  {transferState === "success" ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Transferred!
                    </>
                  ) : (
                    <>
                      <ArrowDown />
                      Transfer to Notes
                    </>
                  )}
                </Button>
                {transferState === "error" && transferError && (
                  <span className="text-xs text-red-600 dark:text-red-400">{transferError}</span>
                )}
              </>
            )}
            <DropdownButton label="Export" options={["Copy Text", "Download .txt", "Download .pdf"]} onChange={handleExport} />
          </div>
        }
      />
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
            <Button
              variant="link"
              size="xs"
              onClick={() => void cancelAnalysisJob()}
              className="mt-1 text-indigo-600 dark:text-indigo-400"
            >
              Dismiss &amp; retry
            </Button>
          </div>
        ) : analysisReady && draft ? (
          <pre data-testid="analysis-draft-content" className="whitespace-pre-wrap font-sans">{draft}</pre>
        ) : analysisRunning ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ProgressBar
              progress={analysisJob?.progress ?? 0}
              stage={analysisJob?.stage ?? "draft"}
              label={`Generating ${selectedLabel}`}
              indeterminate={!analysisJob || analysisJob.progress < 80}
            />
            <Button
              data-testid="action-cancel-analysis"
              variant="ghost"
              size="xs"
              onClick={() => void cancelAnalysisJob()}
              className="mt-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
            >
              Cancel
            </Button>
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
          <div data-testid="analysis-ready-prompt" className="flex flex-col items-center justify-center h-full gap-4">
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
            <Button
              data-testid="action-generate-note"
              onClick={handleGenerateNote}
              disabled={starting}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-sm px-6"
            >
              {starting ? "Starting..." : `Generate ${selectedLabel}`}
            </Button>
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
            <Button
              data-testid="action-cancel-job"
              variant="ghost"
              size="xs"
              onClick={() => void cancelJob()}
              className="mt-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500">Upload audio to get started.</p>
          </div>
        )}
      </div>
      {jobNotice && (
        <div
          className={`flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
            jobNotice.type === "cancelled"
              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          }`}
        >
          <span>{jobNotice.message}</span>
          <button type="button" onClick={clearJobNotice} className="ml-1 opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}
    </section>
  );
}
