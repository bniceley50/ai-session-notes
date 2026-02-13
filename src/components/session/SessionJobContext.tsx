"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { JobStatusFile } from "@/lib/jobs/status";

type JobRecord = JobStatusFile;

/** Callback NoteEditor registers so AIAnalysisViewer can push content into it */
type TransferToNotesCallback = (content: string, noteType?: string) => void;

/** Lightweight notice shown after cancel/delete/error */
type JobNotice = {
  type: "cancelled" | "error";
  message: string;
};

type SessionJobContextValue = {
  jobId: string | null;
  job: JobRecord | null;
  audioArtifactId: string | null;
  jobNotice: JobNotice | null;
  setJobId: (id: string | null) => void;
  setAudioArtifactId: (id: string | null) => void;
  startPolling: (url: string) => void;
  stopPolling: () => void;
  /** Cancel the current transcription job (DELETE + reset state) */
  cancelJob: () => Promise<void>;
  /** Delete a completed/failed job (DELETE + reset state) */
  deleteJob: () => Promise<void>;
  clearJobNotice: () => void;
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
  const [jobNotice, setJobNotice] = useState<JobNotice | null>(null);
  const pollRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
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

  const clearJobNotice = useCallback(() => {
    setJobNotice(null);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const showNotice = useCallback((notice: JobNotice, autoCloseMs = 3000) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setJobNotice(notice);
    noticeTimerRef.current = window.setTimeout(() => {
      setJobNotice(null);
      noticeTimerRef.current = null;
    }, autoCloseMs);
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  /** Shared reset: stop polling, clear state, DELETE on server, show notice */
  const resetJob = useCallback(async (successMsg: string, errorMsg: string) => {
    const currentJobId = jobId;
    stopPolling();
    setJobId(null);
    setJob(null);
    setAudioArtifactId(null);

    if (currentJobId) {
      try {
        await fetch(`/api/jobs/${currentJobId}`, {
          method: "DELETE",
          credentials: "include",
        });
        showNotice({ type: "cancelled", message: successMsg });
      } catch {
        showNotice({ type: "error", message: errorMsg });
      }
    } else {
      showNotice({ type: "cancelled", message: successMsg });
    }
  }, [jobId, showNotice]);

  const cancelJob = useCallback(async () => {
    await resetJob("Job cancelled.", "Could not cancel job.");
  }, [resetJob]);

  const deleteJob = useCallback(async () => {
    await resetJob("Job deleted.", "Could not delete job.");
  }, [resetJob]);

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
    jobNotice,
    setJobId,
    setAudioArtifactId,
    startPolling,
    stopPolling,
    cancelJob,
    deleteJob,
    clearJobNotice,
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

