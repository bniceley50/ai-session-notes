"use client";

import { useRef, useState } from "react";
import { useSessionJob } from "./SessionJobContext";

type Props = { sessionId: string };

type UploadResponse = {
  artifactId: string;
  filename: string;
  mime: string;
  bytes: number;
};

type CreateJobResponse = {
  jobId: string;
  sessionId: string;
  statusUrl: string;
};

export function AudioInput({ sessionId }: Props) {
  const { setJobId, startPolling } = useSessionJob();
  const [activeTab, setActiveTab] = useState<"record" | "upload">("upload");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    try {
      // Step 1: Upload audio
      const uploadUrl = `/api/sessions/${encodeURIComponent(sessionId)}/audio?filename=${encodeURIComponent(selectedFile.name)}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "audio/webm" },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const uploadData = (await uploadResponse.json()) as UploadResponse;

      // Step 2: Create job
      const createResponse = await fetch("/api/jobs/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          audioArtifactId: uploadData.artifactId,
        }),
      });

      if (!createResponse.ok) {
        throw new Error("Job creation failed");
      }

      const jobData = (await createResponse.json()) as CreateJobResponse;

      // Step 3: Set jobId and start polling
      setJobId(jobData.jobId);
      startPolling(jobData.statusUrl);

      setStatus("idle");
      setSelectedFile(null);
    } catch {
      setStatus("error");
      setError("Upload failed. Please try again.");
    }
  };

  return (
    <section className="card-base h-full flex flex-col gap-4 min-h-[260px]">
      {/* Header */}
      <header>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Audio Input</h3>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 -mb-2">
        <button
          type="button"
          onClick={() => setActiveTab("record")}
          className={`pb-2 px-1 text-sm font-semibold transition-colors ${
            activeTab === "record"
              ? "text-red-600 border-b-2 border-red-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Record
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`pb-2 px-1 text-sm font-semibold transition-colors ${
            activeTab === "upload"
              ? "text-red-600 border-b-2 border-red-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Upload
        </button>
      </div>

      {/* Record tab content */}
      {activeTab === "record" && (
        <>
          {/* Microphone + Waveform */}
          <div className="flex-1 flex items-center justify-center gap-4">
            {/* Microphone button */}
            <button
              type="button"
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg transition"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>

            {/* Animated waveform bars */}
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
          </div>

          {/* Timer display */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="font-semibold text-red-600">RECORDING</span>
            <span className="text-slate-600 dark:text-slate-400">04:23 / 30:00</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Pause
            </button>
            <button
              type="button"
              className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Stop
            </button>
            <button
              type="button"
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-sm font-semibold text-white shadow-sm transition"
            >
              Save
            </button>
          </div>
        </>
      )}

      {/* Upload tab content */}
      {activeTab === "upload" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/webm,video/webm,.webm"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              {selectedFile ? selectedFile.name : "Choose a WebM audio file to upload (.webm)"}
            </p>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={status === "uploading"}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition disabled:opacity-50"
            >
              {selectedFile ? "Change File" : "Choose File"}
            </button>
          </div>
          {selectedFile && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === "uploading"}
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
            >
              {status === "uploading" ? "Uploading..." : "Start Processing"}
            </button>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
