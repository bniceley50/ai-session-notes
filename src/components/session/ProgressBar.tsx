"use client";

import type { JobStage } from "@/lib/jobs/status";

const STAGE_LABELS: Record<string, string> = {
  upload: "Uploading",
  transcribe: "Transcribing",
  draft: "Generating note",
  export: "Exporting",
};

type Props = {
  /** 0–100 */
  progress: number;
  stage: JobStage | string;
  /** Optional override for the label shown */
  label?: string;
  /** When true, shows a pulsing/indeterminate animation on the filled portion */
  indeterminate?: boolean;
  /** Optional override for the small subtitle below the bar (pass "" to hide) */
  subtitle?: string;
};

export function ProgressBar({ progress, stage, label, indeterminate, subtitle }: Props) {
  const clamped = Math.max(0, Math.min(100, progress));
  const stageLabel = label ?? STAGE_LABELS[stage] ?? stage;

  // Determine subtitle: explicit prop wins, "" hides it, undefined falls back to auto
  const autoSubtitle =
    stage === "transcribe" && clamped < 40 ? "Processing audio…" :
    stage === "transcribe" && clamped >= 40 ? "Transcript ready" :
    stage === "draft" && clamped < 80 ? "AI is writing…" :
    stage === "draft" && clamped >= 80 ? "Note generated" :
    stage === "export" && clamped < 100 ? "Finalizing…" :
    stage === "export" && clamped >= 100 ? "Done" :
    stage === "upload" ? "Uploading file…" : "";

  const shownSubtitle = subtitle !== undefined ? subtitle : autoSubtitle;

  return (
    <div className="w-full max-w-[220px] flex flex-col gap-1.5">
      {/* Label + percentage */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">{stageLabel}</span>
        <span className="tabular-nums">{indeterminate && clamped < 100 ? "\u2026" : `${clamped}%`}</span>
      </div>

      {/* Track */}
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        {/* Fill */}
        <div
          className={[
            "h-full rounded-full transition-all duration-700 ease-out",
            clamped >= 100
              ? "bg-emerald-500"
              : "bg-indigo-500",
            indeterminate && clamped < 100
              ? "animate-pulse"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ width: `${indeterminate && clamped < 5 ? 5 : clamped}%` }}
        />
      </div>

      {/* Stage subtitle */}
      {shownSubtitle && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 capitalize">
          {shownSubtitle}
        </p>
      )}
    </div>
  );
}
