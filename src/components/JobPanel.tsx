"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobRecord } from "@/lib/jobs/types";

const STORAGE_KEY = "asn_current_job";
const POLL_MS = 2000;

export default function JobPanel() {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [demoLoginError, setDemoLoginError] = useState<string | null>(null);
  const [demoLogoutError, setDemoLogoutError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [authedLabel, setAuthedLabel] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<JobRecord>;
      if (!parsed?.jobId || !parsed?.expiresAt) {
        window.localStorage.removeItem(STORAGE_KEY);
        setJob(null);
        return;
      }
      if (Date.parse(parsed.expiresAt) <= Date.now()) {
        window.localStorage.removeItem(STORAGE_KEY);
        setJob(null);
        return;
      }
      const nowIso = new Date().toISOString();
      const baseStatus = parsed.status ?? "queued";
      const baseCreatedAt = parsed.createdAt ?? nowIso;
      const baseProgress = typeof parsed.progress === "number" ? parsed.progress : 0;
      setJob({
        jobId: parsed.jobId,
        practiceId: parsed.practiceId ?? "",
        status: baseStatus,
        progress: baseProgress,
        createdAt: baseCreatedAt,
        updatedAt: parsed.updatedAt ?? baseCreatedAt,
        statusHistory:
          Array.isArray(parsed.statusHistory) && parsed.statusHistory.length > 0
            ? parsed.statusHistory
            : [{ status: baseStatus, at: baseCreatedAt, progress: baseProgress }],
        expiresAt: parsed.expiresAt,
      });
    } catch (error) {
      window.localStorage.removeItem(STORAGE_KEY);
      setJob(null);
      setMessage("Unable to read saved job.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        if (!response.ok) {
          setIsAuthed(false);
          setAuthedLabel(null);
          return;
        }
        const data = (await response.json()) as { email?: string; role?: string };
        setIsAuthed(true);
        if (data?.email || data?.role) {
          const labelParts = [data.email, data.role].filter(Boolean);
          setAuthedLabel(labelParts.join(" "));
        } else {
          setAuthedLabel(null);
        }
      } catch (error) {
        if (cancelled) return;
        setIsAuthed(false);
        setAuthedLabel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const expiresAtLabel = useMemo(() => {
    if (!job?.expiresAt) return null;
    const date = new Date(job.expiresAt);
    return Number.isNaN(date.getTime()) ? job.expiresAt : date.toLocaleString();
  }, [job?.expiresAt]);

  const isExpired = useMemo(() => {
    if (!job?.expiresAt) return false;
    const timestamp = Date.parse(job.expiresAt);
    if (Number.isNaN(timestamp)) return false;
    return timestamp <= Date.now();
  }, [job?.expiresAt]);

  const handleCreate = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/jobs/create", { method: "POST" });
      if (response.status === 401) {
        setMessage("Please sign in to create a job.");
        return;
      }
      if (!response.ok) {
        setMessage("Unable to create a job.");
        return;
      }
      const created = (await response.json()) as JobRecord;
      if (!created?.jobId || !created?.expiresAt) {
        setMessage("Unexpected job response.");
        return;
      }
      setJob(created);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    } catch (error) {
      setMessage("Unable to create a job.");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (!job?.jobId) return;

    let cancelled = false;
    let inFlight = false;
    let activeController: AbortController | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const currentJobId = job.jobId;

    const pollOnce = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      activeController?.abort();
      activeController = new AbortController();
      try {
        const response = await fetch(`/api/jobs/${currentJobId}`, {
          method: "GET",
          signal: activeController.signal,
        });

        if (response.status === 401) {
          if (!cancelled) {
            setMessage("Please sign in to view job status.");
            setJob(null);
            window.localStorage.removeItem(STORAGE_KEY);
          }
          cancelled = true;
          if (intervalId) clearInterval(intervalId);
          return;
        }

        if (response.status === 404) {
          if (!cancelled) {
            setMessage("Job not found (server restarted).");
            setJob(null);
            window.localStorage.removeItem(STORAGE_KEY);
          }
          cancelled = true;
          if (intervalId) clearInterval(intervalId);
          return;
        }

        if (!response.ok) {
          if (!cancelled) {
            setMessage("Unable to load job status.");
          }
          return;
        }

        const next = (await response.json()) as JobRecord;
        if (!cancelled) {
          setJob(next);
        }

        if (next?.status === "complete" || next?.status === "failed") {
          cancelled = true;
          if (intervalId) clearInterval(intervalId);
        }
      } catch (error) {
        if (!cancelled && (error as { name?: string })?.name !== "AbortError") {
          setMessage("Unable to load job status.");
        }
      } finally {
        inFlight = false;
      }
    };

    intervalId = setInterval(() => void pollOnce(), POLL_MS);
    void pollOnce();

    return () => {
      cancelled = true;
      activeController?.abort();
      if (intervalId) clearInterval(intervalId);
    };
  }, [job?.jobId]);

  const handleDelete = async () => {
    if (!job) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/jobs/${job.jobId}`, { method: "DELETE" });
      if (response.status === 401) {
        setMessage("Please sign in to delete a job.");
        return;
      }
      if (!response.ok && response.status !== 404) {
        setMessage("Unable to delete the job.");
        return;
      }
      setJob(null);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      setMessage("Unable to delete the job.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsBusy(true);
    setDemoLoginError(null);
    try {
      const response = await fetch(
        "/api/auth/dev-login?email=test@example.com&role=admin",
        { method: "GET", credentials: "include" }
      );
      if (!response.ok) {
        setDemoLoginError(
          response.status === 404 ? "Demo login unavailable." : "Demo login failed."
        );
        return;
      }
      window.location.reload();
    } catch (error) {
      setDemoLoginError("Demo login failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogout = async () => {
    setIsBusy(true);
    setDemoLogoutError(null);
    try {
      let response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.status === 405) {
        response = await fetch("/api/auth/logout", {
          method: "GET",
          credentials: "include",
        });
      }
      if (!response.ok) {
        setDemoLogoutError(
          response.status === 404 ? "Logout unavailable." : "Logout failed."
        );
        return;
      }
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    } catch (error) {
      setDemoLogoutError("Logout failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const showDemoLogin = isDev && isAuthed === false;
  const showDevAuthControls = isDev && isAuthed === true;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Job panel</h2>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Ephemeral session work
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isBusy}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start new job
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!job || isBusy}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete now
          </button>
        </div>
      </div>
      {showDevAuthControls ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            Signed in (dev)
            {authedLabel ? `: ${authedLabel}` : null}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isBusy}
            className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Logout
          </button>
          {demoLogoutError ? (
            <span className="text-rose-600">{demoLogoutError}</span>
          ) : null}
        </div>
      ) : null}
      {job ? (
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          <div>
            <span className="font-semibold text-slate-900">Job ID:</span>{" "}
            <span className="font-mono">{job.jobId.slice(0, 8)}</span>
            <span className="text-slate-400">â€¦</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Status:</span>{" "}
            <span className="capitalize">{job.status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <progress max={100} value={job.progress} className="h-2 w-40" />
            <span>{job.progress}%</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Updated:</span>{" "}
            <span>
              {job.updatedAt ? new Date(job.updatedAt).toLocaleTimeString() : "â€”"}
            </span>
          </div>
          {job.statusHistory?.length ? (
            <div className="mt-2 text-sm">
              <div className="font-semibold text-slate-900">Timeline:</div>
              <ul className="mt-1 grid gap-1">
                {job.statusHistory.map((event, idx) => {
                  const time = new Date(event.at);
                  return (
                    <li
                      key={`${event.at}-${idx}`}
                      className="flex items-center gap-2 text-slate-700"
                    >
                      <span className="tabular-nums text-slate-500">
                        {Number.isNaN(time.getTime()) ? "â€”" : time.toLocaleTimeString()}
                      </span>
                      <span className="capitalize">{event.status}</span>
                      <span className="text-slate-500">({event.progress}%)</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div>
            <span className="font-semibold text-slate-900">Expires:</span>{" "}
            <span>{expiresAtLabel ?? job.expiresAt}</span>
            {isExpired ? <span className="ml-2 text-rose-600">(expired)</span> : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">No active job yet.</p>
      )}
      {message ? <p className="mt-4 text-sm text-rose-600">{message}</p> : null}
      {showDemoLogin ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isBusy}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Demo Login
          </button>
          {demoLoginError ? (
            <span className="text-xs text-rose-600">{demoLoginError}</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}