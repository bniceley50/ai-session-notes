"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSessionJob } from "./SessionJobContext";
import { DropdownButton } from "@/components/ui/DropdownButton";
import { jsPDF } from "jspdf";

type Props = { sessionId: string };
type NoteType = "soap" | "dap" | "birp" | "girp" | "intake" | "progress" | "freeform";

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "soap", label: "SOAP Note" },
  { value: "dap", label: "DAP Note" },
  { value: "birp", label: "BIRP Note" },
  { value: "girp", label: "GIRP Note" },
  { value: "intake", label: "Intake/Assessment" },
  { value: "progress", label: "Progress Note" },
  { value: "freeform", label: "Freeform" },
];

export function NoteEditor({ sessionId }: Props) {
  const { onTransferToNotes } = useSessionJob();
  const [noteType, setNoteType] = useState<NoteType>("soap");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  // When a transfer just happened, skip the next fetch so it doesn't overwrite
  const skipNextFetchRef = useRef(false);

  // Register callback so AIAnalysisViewer can push content into this editor
  const handleTransfer = useCallback((content: string, incomingNoteType?: string) => {
    // Flag: skip the fetch that will fire when noteType changes
    skipNextFetchRef.current = true;
    // Switch to the matching note type if valid, otherwise stay on current
    if (incomingNoteType) {
      const match = NOTE_TYPES.find((t) => t.value === incomingNoteType);
      if (match) {
        setNoteType(match.value);
      }
    }
    setNote(content);
    setLoading(false);
  }, []);

  useEffect(() => {
    onTransferToNotes(handleTransfer);
  }, [onTransferToNotes, handleTransfer]);

  // Fetch note when component mounts or noteType changes
  useEffect(() => {
    // If a transfer just set the content, don't overwrite it with a fetch
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

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
          // If server error (e.g. session not in Supabase yet), just start with empty note
          if (!cancelled) {
            setNote("");
            setLoading(false);
          }
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setNote(data.content || "");
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          // Network error — silently start with empty note
          setNote("");
          setLoading(false);
        }
      }
    }

    fetchNote();

    return () => {
      cancelled = true;
    };
  }, [sessionId, noteType]);

  const handleSaveDraft = async () => {
    if (loading || saving) return;
    setSaving(true);
    setError("");
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
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear this note?")) {
      return;
    }

    setNote("");
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/notes`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: noteType, content: "" }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to clear note");
      }
    } catch (err) {
      setError("Failed to clear note");
    } finally {
      setSaving(false);
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
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
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
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>
          <DropdownButton
            label="Copy/Export"
            options={["Copy to Clipboard", "Download .txt", "Download .docx", "Download .pdf"]}
            onChange={handleExport}
            buttonClassName="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition shadow-sm"
            itemClassName="block w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            menuClassName="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
          />
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
              rows={10}
              className="flex-1 min-h-[200px] resize-y rounded-lg bg-slate-50 dark:bg-slate-900 p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:outline-none"
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
