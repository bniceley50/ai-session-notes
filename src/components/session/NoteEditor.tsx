"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import { useSessionJob } from "./SessionJobContext";
import { Button } from "@/components/ui/button";
import { DropdownButton } from "@/components/ui/DropdownButton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
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
    setConfirmClearOpen(false);
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
      toast.warning("No content available to export yet.");
      return;
    }

    switch (option) {
      case "Copy to Clipboard":
        navigator.clipboard.writeText(note)
          .then(() => toast.success("Copied to clipboard"))
          .catch(() => toast.error("Failed to copy to clipboard"));
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
        toast.info("Word document export coming soon");
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
          toast.error("Failed to generate PDF");
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
          <Button variant="outline" size="sm" onClick={handleSaveDraft}>
            <Save /> Save Draft
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmClearOpen(true)}>
            <Trash2 /> Clear
          </Button>
          <DropdownButton
            label="Copy/Export"
            options={["Copy to Clipboard", "Download .txt", "Download .docx", "Download .pdf"]}
            onChange={handleExport}
            buttonClassName="bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-sm"
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

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will erase all content in the current note. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleClear()}>
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
