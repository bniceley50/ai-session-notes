"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MicrophoneIcon,
  PauseIcon,
  StopIcon,
  ArrowUpTrayIcon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/solid";

type Tab = "record" | "upload";
type UiStatus = "Idle" | "Recording" | "Paused" | "Ready" | "Uploading" | "Error";

type JobStatus = "queued" | "running" | "complete" | "failed" | "deleted";
type JobStage = "upload" | "transcribe" | "draft" | "export";

type JobStatusResponse = {
  jobId: string;
  sessionId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  updatedAt: string;
  errorMessage: string | null;
};

type UploadResponse = {
  artifactId: string;
  filename: string;
  mime: string;
  bytes: number;
  createdAt: string;
  downloadUrl?: string;
};

type CreateJobResponse = {
  jobId: string;
  sessionId: string;
  statusUrl: string;
};

const POLL_MS = 1500;
const MAX_DURATION_SEC = 30 * 60;

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
};

const MIME_BY_EXT: Record<string, string> = {
  ".webm": "audio/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
};

function formatTime(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toTitle(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeMime(value: string) {
  return value.split(";")[0]?.trim().toLowerCase();
}

function inferMimeFromFilename(filename: string) {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = filename.slice(dot).toLowerCase();
  return MIME_BY_EXT[ext] ?? null;
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  const clamped = clampProgress(value);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700 dark:text-slate-200 font-medium">{label}</span>
        <span className="text-slate-400 font-mono text-xs">{clamped}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function WaveformPlaceholder() {
  return (
    <svg viewBox="0 0 600 60" className="w-full h-10">
      <g className="text-slate-300 dark:text-slate-600" fill="currentColor">
        {Array.from({ length: 60 }).map((_, i) => {
          const h = 8 + (i % 10) * 4;
          const x = 10 * i;
          const y = (60 - h) / 2;
          return <rect key={i} x={x} y={y} width="6" height={h} rx="3" />;
        })}
      </g>
    </svg>
  );
}

type JobPanelProps = {
  sessionId?: string;
};

type UploadPayload = {
  blob: Blob;
  filename: string;
  mime: string;
};

export default function JobPanel({ sessionId }: JobPanelProps) {
  const [tab, setTab] = useState<Tab>("record");
  const [status, setStatus] = useState<UiStatus>("Idle");
  const [error, setError] = useState<string>("");

  const resolvedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  const hasSession = resolvedSessionId.length > 0;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [pTranscribe, setPTranscribe] = useState(0);
  const [pDraft, setPDraft] = useState(0);
  const [pExport, setPExport] = useState(0);

  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);

  const canRecord = useMemo(
    () => typeof window !== "undefined" && !!navigator.mediaDevices,
    []
  );

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  function resetPipeline() {
    setJobStatus(null);
    setJobId(null);
    setStatusUrl(null);
    setPTranscribe(0);
    setPDraft(0);
    setPExport(0);
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }

  function startTicker() {
    if (tickRef.current) return;
    tickRef.current = window.setInterval(() => {
      setElapsedSec((s) => {
        const next = s + 1;
        return next >= MAX_DURATION_SEC ? MAX_DURATION_SEC : next;
      });
    }, 1000);
  }

  function stopTicker() {
    if (!tickRef.current) return;
    window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  async function startRecording() {
    setError("");
    resetPipeline();
    if (!canRecord) {
      setStatus("Error");
      setError("Recording not supported in this browser/environment.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      chunksRef.current = [];
      setRecordedBlob(null);
      setSelectedFile(null);
      setElapsedSec(0);

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stopTicker();
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setStatus("Ready");
      };

      mr.start(250);
      setStatus("Recording");
      startTicker();
    } catch (e: any) {
      setStatus("Error");
      setError(e?.message || "Microphone permission denied or unavailable.");
    }
  }

  function pauseRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr) return;

    if (mr.state === "recording") {
      mr.pause();
      setStatus("Paused");
      stopTicker();
    } else if (mr.state === "paused") {
      mr.resume();
      setStatus("Recording");
      startTicker();
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (mr.state !== "inactive") {
      mr.stop();
    }
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(f: File | null) {
    resetPipeline();
    setSelectedFile(f);
    setRecordedBlob(null);
    setElapsedSec(0);
    setStatus(f ? "Ready" : "Idle");
  }

  function resolveUploadPayload(): UploadPayload | null {
    if (selectedFile) {
      const inferred = normalizeMime(selectedFile.type) || inferMimeFromFilename(selectedFile.name) || "";
      const mime = inferred || "application/octet-stream";
      return { blob: selectedFile, filename: selectedFile.name, mime };
    }

    if (recordedBlob) {
      const mime = normalizeMime(recordedBlob.type) || "audio/webm";
      const ext = EXT_BY_MIME[mime] ?? ".webm";
      return { blob: recordedBlob, filename: `recording${ext}`, mime };
    }

    return null;
  }

  async function readErrorMessage(response: Response, fallback: string) {
    try {
      const data = (await response.json()) as {
        error?: { message?: string } | string;
      };
      if (typeof data?.error === "string") return data.error;
      if (typeof data?.error === "object" && data.error?.message) return data.error.message;
    } catch {
      // ignore
    }
    return fallback;
  }

  function applyProgressFromStatus(data: JobStatusResponse) {
    if (data.status === "failed") {
      return;
    }
    if (data.status === "deleted") {
      setPTranscribe(0);
      setPDraft(0);
      setPExport(0);
      return;
    }
    if (data.status === "complete") {
      setPTranscribe(100);
      setPDraft(100);
      setPExport(100);
      return;
    }

    const progress = clampProgress(data.progress);
    if (data.stage === "upload") {
      setPTranscribe(0);
      setPDraft(0);
      setPExport(0);
      return;
    }
    if (data.stage === "transcribe") {
      setPTranscribe(progress);
      setPDraft(0);
      setPExport(0);
      return;
    }
    if (data.stage === "draft") {
      setPTranscribe(100);
      setPDraft(progress);
      setPExport(0);
      return;
    }
    if (data.stage === "export") {
      setPTranscribe(100);
      setPDraft(100);
      setPExport(progress);
    }
  }

  async function pollStatus(url: string) {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const message = await readErrorMessage(response, "Unable to read job status.");
        setStatus("Error");
        setError(message);
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }

      const data = (await response.json()) as JobStatusResponse;
      setJobStatus(data);
      applyProgressFromStatus(data);

      if (data.status === "failed" && data.errorMessage) {
        setError(data.errorMessage);
      }

      if (data.status === "complete" || data.status === "failed" || data.status === "deleted") {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      setStatus("Error");
      setError("Unable to read job status.");
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(url: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    void pollStatus(url);
    pollRef.current = window.setInterval(() => {
      void pollStatus(url);
    }, POLL_MS);
  }

  async function uploadAndCreateJob() {
    if (!hasSession) {
      setStatus("Error");
      setError("Open a session page to upload audio.");
      return;
    }

    const payload = resolveUploadPayload();
    if (!payload) return;

    setError("");
    setStatus("Uploading");
    setJobStatus(null);
    setPTranscribe(0);
    setPDraft(0);
    setPExport(0);

    try {
      const uploadUrl = `/api/sessions/${encodeURIComponent(resolvedSessionId)}/audio?filename=${encodeURIComponent(
        payload.filename
      )}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": payload.mime },
        body: payload.blob,
      });

      if (!uploadResponse.ok) {
        const message = await readErrorMessage(uploadResponse, "Unable to upload audio.");
        setStatus("Error");
        setError(message);
        return;
      }

      const uploadData = (await uploadResponse.json()) as UploadResponse;

      const createResponse = await fetch("/api/jobs/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: resolvedSessionId,
          audioArtifactId: uploadData.artifactId,
        }),
      });

      if (!createResponse.ok) {
        const message = await readErrorMessage(createResponse, "Unable to create job.");
        setStatus("Error");
        setError(message);
        return;
      }

      const jobData = (await createResponse.json()) as CreateJobResponse;
      setJobId(jobData.jobId);
      setStatusUrl(jobData.statusUrl);
      setJobStatus(null);
      startPolling(jobData.statusUrl);
    } catch {
      setStatus("Error");
      setError("Unable to upload audio.");
    }
  }

  const payloadReady = !!resolveUploadPayload();
  const isDeleted = jobStatus?.status === "deleted";
  const outputJobId = jobStatus?.jobId ?? null;
  const transcriptUrl = outputJobId ? `/api/jobs/${outputJobId}/transcript` : "";
  const draftUrl = outputJobId ? `/api/jobs/${outputJobId}/draft` : "";
  const exportUrl = outputJobId ? `/api/jobs/${outputJobId}/export` : "";
  const uploadEnabled =
    hasSession &&
    status === "Ready" &&
    payloadReady &&
    !isDeleted;

  const statusKind = jobStatus ? jobStatus.status : status;
  const statusLabel = jobStatus ? toTitle(jobStatus.status) : status;

  const statusPill = (() => {
    const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";
    if (statusKind === "complete") return `${base} bg-emerald-100 text-emerald-700`;
    if (statusKind === "failed") return `${base} bg-rose-100 text-rose-700`;
    if (statusKind === "deleted") return `${base} bg-slate-200 text-slate-600`;
    if (statusKind === "queued" || statusKind === "running" || statusKind === "Uploading")
      return `${base} bg-indigo-100 text-indigo-700`;
    if (statusKind === "Recording" || statusKind === "Paused")
      return `${base} bg-rose-100 text-rose-700`;
    if (statusKind === "Error") return `${base} bg-amber-100 text-amber-800`;
    return `${base} bg-slate-100 text-slate-600`;
  })();

  return (
    <section className="card-base h-full flex flex-col">
      <div className="flex-none">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Job Panel</h2>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
          Audio Input
        </p>

        <div className="mt-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-8 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setTab("record")}
              className={`pb-2 ${
                tab === "record"
                  ? "text-indigo-700 dark:text-indigo-200 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Record
            </button>
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`pb-2 ${
                tab === "upload"
                  ? "text-indigo-700 dark:text-indigo-200 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Upload
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-4 space-y-4">
        {tab === "record" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={status === "Recording" || status === "Paused" ? stopRecording : startRecording}
                className="relative grid place-items-center h-20 w-20 rounded-full bg-rose-600 shadow-md hover:bg-rose-500 transition-colors ring-1 ring-rose-700/20"
                title={
                  status === "Recording" || status === "Paused"
                    ? "Stop recording"
                    : "Start recording"
                }
              >
                <MicrophoneIcon className="h-10 w-10 text-white" />
              </button>
            </div>

            <div className="px-2">
              <WaveformPlaceholder />
            </div>

            <div className="text-center font-mono text-sm text-slate-600 dark:text-slate-300">
              {formatTime(elapsedSec)} / {formatTime(MAX_DURATION_SEC)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={pauseRecording}
                disabled={!(status === "Recording" || status === "Paused")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <PauseIcon className="h-5 w-5" />
                {status === "Paused" ? "Resume" : "Pause"}
              </button>

              <button
                type="button"
                onClick={stopRecording}
                disabled={!(status === "Recording" || status === "Paused")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <StopIcon className="h-5 w-5" />
                Stop
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={pickFile}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-4 py-6 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <ArrowUpTrayIcon className="h-5 w-5 text-slate-500" />
              {selectedFile ? "Change audio file" : "Choose an audio file"}
            </button>

            {selectedFile && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {selectedFile.name}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 pt-2">
          <ProgressRow label="Transcribe" value={pTranscribe} />
          <ProgressRow label="Draft" value={pDraft} />
          <ProgressRow label="Export" value={pExport} />
        </div>

        {jobStatus?.status === "complete" && outputJobId ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Outputs
            </div>
            <a
              href={transcriptUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
            >
              Transcript
            </a>
            <a
              href={draftUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
            >
              Draft (Markdown)
            </a>
            <a
              href={exportUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
            >
              Export (Text)
            </a>
          </div>
        ) : null}

        {!hasSession ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Open a session page to upload audio.
          </div>
        ) : null}

        <button
          type="button"
          disabled={!uploadEnabled}
          onClick={uploadAndCreateJob}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          <CloudArrowUpIcon className="h-5 w-5" />
          Upload audio
        </button>

        <div className="flex items-center justify-between pt-1">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Status: <span className={statusPill}>{statusLabel}</span>
          </div>
          <div className="text-xs text-slate-400 font-mono truncate max-w-[55%]">
            {resolvedSessionId ? `session: ${resolvedSessionId}` : ""}
          </div>
        </div>

        {jobId ? (
          <div className="text-xs text-slate-400 font-mono truncate">job: {jobId}</div>
        ) : null}

        {status === "Error" && error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        {jobStatus?.status === "failed" && jobStatus.errorMessage ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            {jobStatus.errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}



