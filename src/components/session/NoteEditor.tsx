"use client";

import { useState, useRef, useEffect } from "react";

type Props = { sessionId: string };
type NoteType = "soap" | "dap" | "birp" | "freeform";

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "soap", label: "SOAP Note" },
  { value: "dap", label: "DAP Note" },
  { value: "birp", label: "BIRP Note" },
  { value: "freeform", label: "Freeform" },
];

const MOCK_NOTES: Record<NoteType, string> = {
  soap: `S: Patient states. Ivmeves. Suicidal ideation denied mr mt passive wish for sleep noted.

O: Affect is restricted. Affect br restricted providrz d-enozened until onnosings: affect is restricted.

A: Symptoms consistent with, symptoms consistent with, and necetsary symmons consistent.

P: Continue current medication and continue awast medication in moingarv ureatment.`,
  dap: `D: Patient reports increased anxiety related to housing instability.

A: Anxiety symptoms consistent with GAD. Risk assessment negative for SI.

P: Continue CBT, review coping strategies next session.`,
  birp: `B: Patient engaged in session, discussed housing concerns.

I: CBT techniques applied, cognitive restructuring of worry patterns.

R: Patient demonstrated understanding of thought-behavior connection.

P: Practice thought records daily, follow up in 2 weeks.`,
  freeform: "Draft session note goes here. Highlight key findings and next steps.",
};

function DropdownButton({ label, options }: { label: string; options: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition shadow-sm"
      >
        {label}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteEditor({ sessionId }: Props) {
  const [noteType, setNoteType] = useState<NoteType>("soap");
  const [note, setNote] = useState<string>(MOCK_NOTES.soap);

  return (
    <section className="card-base h-full flex flex-col gap-4 col-span-3">
      {/* Header with title, note type dropdown, and action buttons */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Structured Notes</h3>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Note Type:</label>
            <select
              className="rounded-lg border-2 border-red-500 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-red-600"
              value={noteType}
              onChange={(e) => {
                const newType = e.target.value as NoteType;
                setNoteType(newType);
                setNote(MOCK_NOTES[newType]);
              }}
            >
              {NOTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Draft
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
          <DropdownButton label="Copy/Export" options={["Copy to Clipboard", "Download .txt", "Download .docx", "Download .pdf"]} />
        </div>
      </header>

      {/* Note content */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-slate-50 dark:bg-slate-900 p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-line">
        {note}
      </div>
    </section>
  );
}
