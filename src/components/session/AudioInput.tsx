"use client";

import { useRef, useState } from "react";
import { useSessionJob } from "./SessionJobContext";
import { ProgressBar } from "./ProgressBar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = { sessionId: string };

type UploadResponse = {
  artifactId: string;
  filename: string;
  mime: string;
  bytes: number;
};


export function AudioInput({ sessionId }: Props) {
  const { audioArtifactId, setAudioArtifactId, setJobId, startPolling, job, cancelJob, deleteJob, jobNotice, clearJobNotice } = useSessionJob();
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  type CreateJobResponse = {
    jobId: string;
    sessionId: string;
    statusUrl: string;
  };

  /** After audio upload succeeds, auto-create a job and start polling so
   *  TranscriptViewer populates without requiring a separate button click. */
  const autoStartJob = async (artifactId: string) => {
    setStatus("processing");
    try {
      const response = await fetch("/api/jobs/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, audioArtifactId: artifactId, mode: "transcribe" }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("Auto-start job failed:", response.status, text);
        // Don't throw — audio is already uploaded; user can still trigger manually
        setStatus("idle");
        return;
      }
      const jobData = (await response.json()) as CreateJobResponse;
      setJobId(jobData.jobId);
      startPolling(jobData.statusUrl);
      setStatus("idle");
    } catch (err) {
      console.error("Auto-start job error:", err);
      setStatus("idle");
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setStatus("uploading");
    setError("");
    clearJobNotice();

    try {
      // Step 1: Upload audio
      const uploadUrl = `/api/sessions/${encodeURIComponent(sessionId)}/audio?filename=${encodeURIComponent(selectedFile.name)}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const uploadData = (await uploadResponse.json()) as UploadResponse;

      // Store artifact ID and auto-start the processing pipeline
      setAudioArtifactId(uploadData.artifactId);
      setUploadedFilename(selectedFile.name);
      setSelectedFile(null);

      // Auto-start transcription + analysis pipeline
      await autoStartJob(uploadData.artifactId);
    } catch {
      setStatus("error");
      setError("Upload failed. Please try again.");
    }
  };

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const saveRecording = async () => {
    if (!recordedBlob) return;

    setStatus("uploading");
    setError("");
    clearJobNotice();

    try {
      const filename = `recording-${new Date().toISOString()}.webm`;
      const uploadUrl = `/api/sessions/${encodeURIComponent(sessionId)}/audio?filename=${encodeURIComponent(filename)}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "audio/webm" },
        body: recordedBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const uploadData = (await uploadResponse.json()) as UploadResponse;

      // Store artifact ID and auto-start the processing pipeline
      setAudioArtifactId(uploadData.artifactId);
      setUploadedFilename(filename);

      // Reset recording state
      setRecordedBlob(null);
      setRecordingTime(0);

      // Auto-start transcription + analysis pipeline
      await autoStartJob(uploadData.artifactId);
    } catch {
      setStatus("error");
      setError("Upload failed. Please try again.");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Already uploaded / processing state ──────────────────────
  if (audioArtifactId && uploadedFilename) {
    return (
      <section className="card-base h-full flex flex-col gap-4 min-h-[260px]">
        <header>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Audio Input</h3>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            {job?.status === "failed" ? (
              <>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-red-600 mb-1">Processing failed</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] mx-auto text-center mb-2">
                  {job.errorMessage ?? "Unknown error"}
                </p>
              </>
            ) : status === "processing" ? (
              <>
                <div className="flex justify-center mb-4">
                  <ProgressBar
                    progress={job?.progress ?? 0}
                    stage={job?.stage ?? "transcribe"}
                    label="Processing audio"
                    indeterminate={!job || job.progress < 40}
                  />
                </div>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={async () => {
                    if (isCancelling) return;
                    setIsCancelling(true);
                    try {
                      await cancelJob();
                      setStatus("idle");
                      setUploadedFilename("");
                      setSelectedFile(null);
                    } finally {
                      setIsCancelling(false);
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling…" : "Cancel"}
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">
                  Audio uploaded
                </p>
              </>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate max-w-[200px]">{uploadedFilename}</p>
            {status !== "processing" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAudioArtifactId(null);
                    setUploadedFilename("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Upload Different File
                </button>
                {(job?.status === "complete" || job?.status === "failed") && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                  >
                    Delete job
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <AlertDialog open={confirmDeleteOpen} onOpenChange={(open) => { if (!isDeleting) setConfirmDeleteOpen(open); }}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete job?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the current job artifacts and resets this session workspace. You can upload again anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isDeleting}
                onClick={async () => {
                  if (isDeleting) return;
                  setIsDeleting(true);
                  try {
                    await deleteJob();
                    setStatus("idle");
                    setUploadedFilename("");
                    setSelectedFile(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    );
  }

  // ── Active recording state ───────────────────────────────────
  if (isRecording) {
    return (
      <section className="card-base h-full flex flex-col gap-4 min-h-[260px]">
        <header>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Audio Input</h3>
        </header>

        {/* Microphone + Waveform */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </div>

          {!isPaused && (
            <div className="flex items-center gap-1 h-16">
              {[3, 8, 5, 10, 7, 12, 6, 9, 4, 11, 5, 8].map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-600 rounded-full animate-pulse"
                  style={{
                    height: `${height * 4}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: "0.8s",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Timer display */}
        <div className="flex items-center justify-center gap-2 text-sm">
          {!isPaused && <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />}
          <span className="font-semibold text-red-600">
            {isPaused ? "PAUSED" : "RECORDING"}
          </span>
          <span className="text-slate-600 dark:text-slate-400">{formatTime(recordingTime)}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Stop
          </button>
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </section>
    );
  }

  // ── Recording complete, waiting to save ──────────────────────
  if (recordedBlob) {
    return (
      <section className="card-base h-full flex flex-col gap-4 min-h-[260px]">
        <header>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Audio Input</h3>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Recording complete</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">Duration: {formatTime(recordingTime)}</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setRecordedBlob(null);
                  setRecordingTime(0);
                }}
                className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveRecording}
                disabled={status === "uploading"}
                className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
              >
                {status === "uploading" ? "Uploading..." : "Save & Process"}
              </button>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </section>
    );
  }

  // ── Default state: Record & Upload together ──────────────────
  return (
    <section className="card-base h-full flex flex-col gap-4 min-h-[260px]">
      <header>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Audio Input</h3>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.mp4,.mov,.mpeg"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        {/* Record button */}
        <div className="text-center">
          <button
            type="button"
            onClick={startRecording}
            disabled={status === "uploading"}
            className="w-20 h-20 mx-auto mb-2 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/40 transition disabled:opacity-50"
          >
            <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Record</p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-[200px]">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">or</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Upload area */}
        <div className="text-center">
          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{selectedFile.name}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={status === "uploading"}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={status === "uploading"}
                  className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50"
                >
                  {status === "uploading" ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={status === "uploading"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload audio/video file
            </button>
          )}
        </div>
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
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </section>
  );
}
