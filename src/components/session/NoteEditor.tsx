"use client";

import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";

type Props = { sessionId: string };
type NoteType = "soap" | "dap" | "birp" | "freeform";

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "soap", label: "SOAP Note" },
  { value: "dap", label: "DAP Note" },
  { value: "birp", label: "BIRP Note" },
  { value: "freeform", label: "Freeform" },
];

function DropdownButton({ label, options, onChange }: {
  label: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
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
              onClick={() => { onChange?.(opt); setOpen(false); }}
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
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const saveTimerRef = useRef<number | null>(null);

  // Fetch note when component mounts or noteType changes
  useEffect(() => {
    let cancelled = false;

    async function fetchNote() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/notes?type=${noteType}`,
          { credentials: "include" }
        );

        if (!response.ok) {
          throw new Error("Failed to load note");
        }

        const data = await response.json();
        if (!cancelled) {
          setNote(data.content || "");
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load note");
          setLoading(false);
        }
      }
    }

    fetchNote();

    return () => {
      cancelled = true;
    };
  }, [sessionId, noteType]);

  // Debounced autosave when note changes
  useEffect(() => {
    if (loading) return; // Don't save while initial load is happening

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      async function saveNote() {
        setSaving(true);
        try {
          const response = await fetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/notes`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: noteType, content: note }),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to save note");
          }
        } catch (err) {
          setError("Failed to save note");
        } finally {
          setSaving(false);
        }
      }

      saveNote();
    }, 400);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [note, noteType, sessionId, loading]);

  const handleSaveDraft = () => {
    // Manual save is now handled by autosave, show confirmation
    alert("Note is auto-saved as you type!");
  };

  const handleRegenerate = () => {
    // TODO: Implement regeneration from AI
    alert("Regenerate note from AI (Feature coming soon)");
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear this note?")) {
      return;
    }

    try {
      // Clear locally first for immediate feedback
      setNote("");

      // The autosave will handle persisting the empty content
    } catch (err) {
      setError("Failed to clear note");
    }
  };

  const handleExport = (option: string) => {
    if (!note || note.trim() === "") {
      alert("No content available to export yet.");
      return;
    }

    switch (option) {
      case "Copy to Clipboard":
        navigator.clipboard.writeText(note)
          .then(() => alert("Copied to clipboard!"))
          .catch(() => alert("Failed to copy to clipboard."));
        break;

      case "Download .txt": {
        const blob = new Blob([note], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${noteType}-note-${sessionId}-${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        break;
      }

      case "Download .docx":
        alert("Word document export coming soon!");
        break;

      case "Download .pdf": {
        try {
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const margins = 20;
          const maxWidth = pageWidth - margins * 2;
          const lineHeight = 6;
          let currentY = margins;

          // Split text into lines that fit the page width
          const lines = doc.splitTextToSize(note, maxWidth);

          doc.setFontSize(10);

          // Add lines with pagination
          for (let i = 0; i < lines.length; i++) {
            // Check if we need a new page
            if (currentY + lineHeight > pageHeight - margins) {
              doc.addPage();
              currentY = margins;
            }

            doc.text(lines[i], margins, currentY);
            currentY += lineHeight;
          }

          doc.save(`${noteType}-note-${sessionId}-${new Date().toISOString().split("T")[0]}.pdf`);
        } catch (error) {
          alert("Failed to generate PDF.");
        }
        break;
      }
    }
  };

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
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
          <DropdownButton label="Copy/Export" options={["Copy to Clipboard", "Download .txt", "Download .docx", "Download .pdf"]} onChange={handleExport} />
        </div>
      </header>

      {/* Note content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center p-8 text-sm text-slate-500">
            Loading note...
          </div>
        )}
        {error && (
          <div className="mb-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {!loading && (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Start typing your note here..."
              className="flex-1 min-h-0 resize-none rounded-lg bg-slate-50 dark:bg-slate-900 p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:outline-none"
            />
            {saving && (
              <p className="mt-2 text-xs text-slate-500">Saving...</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
