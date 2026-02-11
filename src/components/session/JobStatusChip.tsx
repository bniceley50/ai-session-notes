import type { JobStage, JobStatus } from "@/lib/jobs/status";

type Props = {
  status: JobStatus;
  stage?: JobStage;
  testId?: string;
};

const STAGE_LABELS: Record<JobStage, string> = {
  upload: "Uploading",
  transcribe: "Transcribing",
  draft: "Drafting",
  export: "Exporting",
};

type ChipStyle = { bg: string; text: string; dot: string; label: string };

const STATUS_STYLES: Record<JobStatus, ChipStyle> = {
  queued: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
    label: "Queued",
  },
  running: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    label: "Running",
  },
  complete: {
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-300",
    dot: "bg-green-500",
    label: "Complete",
  },
  failed: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
    label: "Failed",
  },
  deleted: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
    label: "Cancelled",
  },
};

export function JobStatusChip({ status, stage, testId }: Props) {
  const style = STATUS_STYLES[status];
  const stageLabel = status === "running" && stage ? STAGE_LABELS[stage] : null;
  const label = stageLabel ? `${style.label} \u00b7 ${stageLabel}` : style.label;

  return (
    <span
      data-testid={testId ?? "job-status-chip"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${style.bg} ${style.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}${status === "running" ? " animate-pulse" : ""}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
