"use client";

import { useState, useRef, useEffect, useMemo } from "react";

type DropdownButtonProps = {
  label?: string;
  options: string[];
  value?: string;
  onChange?: (v: string) => void;
  /** Override button classes (replaces default slate style entirely) */
  buttonClassName?: string;
  /** Override menu item classes (replaces default style entirely) */
  itemClassName?: string;
  /** Override menu container classes (replaces default style entirely) */
  menuClassName?: string;
};

/**
 * Shared dropdown button — click-outside closes, zero search, zero icons beyond chevron.
 * Used by TranscriptViewer, AIAnalysisViewer, and NoteEditor.
 */
export function DropdownButton({
  label,
  options,
  value,
  onChange,
  buttonClassName,
  itemClassName,
  menuClassName,
}: DropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const display = useMemo(() => {
    if (label) return value ? `${label}: ${value}` : label;
    return value ?? options[0] ?? "Select";
  }, [label, value, options]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          buttonClassName ??
          "inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {display}
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={
            menuClassName ??
            "absolute right-0 top-full mt-1 z-10 min-w-[120px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
          }
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="menuitem"
              onClick={() => { onChange?.(opt); setOpen(false); }}
              className={
                itemClassName ??
                "block w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
