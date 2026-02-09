"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type JobStatus = "queued" | "uploaded" | "transcribed" | "drafted" | "exported" | "complete" | "failed";

type JobRecord = {
  jobId: string;
  sessionId: string;
  status: JobStatus;
  progress: number;
  updatedAt: string;
};

type SessionJobContextValue = {
  jobId: string | null;
  job: JobRecord | null;
  setJobId: (id: string | null) => void;
  startPolling: (url: string) => void;
  stopPolling: () => void;
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
  const pollRef = useRef<number | null>(null);

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
      if (data.status === "complete" || data.status === "failed") {
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

  const value: SessionJobContextValue = {
    jobId,
    job,
    setJobId,
    startPolling,
    stopPolling,
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
