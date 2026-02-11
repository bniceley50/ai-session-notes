"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { JobStatusFile } from "@/lib/jobs/status";

type JobRecord = JobStatusFile;

/** Callback NoteEditor registers so AIAnalysisViewer can push content into it */
type TransferToNotesCallback = (content: string, noteType?: string) => void;

type SessionJobContextValue = {
  jobId: string | null;
  job: JobRecord | null;
  audioArtifactId: string | null;
  setJobId: (id: string | null) => void;
  setAudioArtifactId: (id: string | null) => void;
  startPolling: (url: string) => void;
  stopPolling: () => void;
  /** Cancel the current transcription job (DELETE + reset state) */
  cancelJob: () => Promise<void>;
  /** Register a callback from NoteEditor to receive transferred content */
  onTransferToNotes: (cb: TransferToNotesCallback) => void;
  /** AIAnalysisViewer calls this to push content into NoteEditor */
  transferToNotes: (content: string, noteType?: string) => void;
};

const SessionJobContext = createContext<SessionJobContextValue | null>(null);

const POLL_INTERVAL_MS = 2000;

type Props = {
  sessionId: string;
  children: ReactNode;
};

export function SessionJobProvider({ sessionId, children }: Props) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [audioArtifactId, setAudioArtifactId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const transferCallbackRef = useRef<TransferToNotesCallback | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollStatus = async (url: string) => {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        stopPolling();
        return;
      }

      const data = (await response.json()) as JobRecord;
      setJob(data);

      // Stop polling when job reaches terminal state
      if (data.status === "complete" || data.status === "failed" || data.status === "deleted") {
        stopPolling();
      }
    } catch {
      stopPolling();
    }
  };

  const startPolling = (url: string) => {
    stopPolling();
    void pollStatus(url);
    pollRef.current = window.setInterval(() => {
      void pollStatus(url);
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const cancelJob = useCallback(async () => {
    const currentJobId = jobId;
    // Stop polling and reset UI state immediately
    stopPolling();
    setJobId(null);
    setJob(null);
    setAudioArtifactId(null);

    // Tell the server to mark the job as deleted (pipeline checks shouldStop)
    if (currentJobId) {
      try {
        await fetch(`/api/jobs/${currentJobId}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {
        // Best-effort — UI is already reset
      }
    }
  }, [jobId]);

  const onTransferToNotes = useCallback((cb: TransferToNotesCallback) => {
    transferCallbackRef.current = cb;
  }, []);

  const transferToNotes = useCallback((content: string, noteType?: string) => {
    transferCallbackRef.current?.(content, noteType);
  }, []);

  const value: SessionJobContextValue = {
    jobId,
    job,
    audioArtifactId,
    setJobId,
    setAudioArtifactId,
    startPolling,
    stopPolling,
    cancelJob,
    onTransferToNotes,
    transferToNotes,
  };

  return <SessionJobContext.Provider value={value}>{children}</SessionJobContext.Provider>;
}

export function useSessionJob() {
  const context = useContext(SessionJobContext);
  if (!context) {
    throw new Error("useSessionJob must be used within SessionJobProvider");
  }
  return context;
}
