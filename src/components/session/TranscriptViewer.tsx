"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSessionJob } from "./SessionJobContext";
import { JobStatusChip } from "./JobStatusChip";
import { PanelHeader } from "./PanelHeader";
import { ProgressBar } from "./ProgressBar";
import { Button } from "@/components/ui/button";
import { DropdownButton } from "@/components/ui/DropdownButton";

type Props = { sessionId: string };

export function TranscriptViewer({ sessionId }: Props) {
  const { jobId, job, cancelJob } = useSessionJob();
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

  const isFailed = job?.status === "failed";
  const isReady = job && (job.status === "complete" || job.progress >= 40);
  const isRunning = job && job.status !== "complete" && job.status !== "failed" && !isReady;

  const handleExport = (option: string) => {
    if (!transcript || transcript === "") {
      toast.warning("No transcript available to export yet.");
      return;
    }

    switch (option) {
      case "Copy Text":
        navigator.clipboard.writeText(transcript)
          .then(() => toast.success("Copied to clipboard"))
          .catch(() => toast.error("Failed to copy to clipboard"));
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
        toast.success("Download started");
        break;
      }

      case "Download .docx":
        toast.info("Word document export coming soon");
        break;
    }
  };

  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[260px]">
      <PanelHeader
        testId="panel-header-transcript"
        title="Transcript"
        status={job ? <JobStatusChip status={job.status} stage={job.stage} testId="status-chip-transcript" /> : undefined}
        actions={<DropdownButton label="Export" options={["Copy Text", "Download .txt", "Download .docx"]} onChange={handleExport} />}
      />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : isFailed ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-red-600">Transcription failed</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[260px] text-center">
              {job?.errorMessage ?? "Unknown error"}
            </p>
          </div>
        ) : isReady && transcript ? (
          <pre data-testid="transcript-content" className="whitespace-pre-wrap font-sans">{transcript}</pre>
        ) : isRunning || (jobId && !isReady) ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ProgressBar
              progress={job?.progress ?? 0}
              stage={job?.stage ?? "transcribe"}
              label="Transcribing audio"
              indeterminate={!job || job.progress < 40}
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
            <p className="text-sm text-slate-500">Upload audio to see transcript.</p>
          </div>
        )}
      </div>
    </section>
  );
}
