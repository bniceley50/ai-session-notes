"use client";

import { useEffect, useMemo, useState } from "react";

type JobMeta = {
  jobId: string;
  expiresAt: string;
};

const STORAGE_KEY = "asn_current_job";

export default function JobPanel() {
  const [job, setJob] = useState<JobMeta | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as JobMeta;
      if (parsed?.jobId && parsed?.expiresAt) {
        setJob(parsed);
      }
    } catch (error) {
      setMessage("Unable to read saved job.");
    }
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
      const data = (await response.json()) as JobMeta;
      if (!data?.jobId || !data?.expiresAt) {
        setMessage("Unexpected job response.");
        return;
      }
      setJob(data);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      setMessage("Unable to create a job.");
    } finally {
      setIsBusy(false);
    }
  };

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
      {job ? (
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          <div>
            <span className="font-semibold text-slate-900">Job ID:</span>{" "}
            <span className="font-mono">{job.jobId.slice(0, 8)}</span>
            <span className="text-slate-400">…</span>
          </div>
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
    </section>
  );
}
