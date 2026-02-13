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
import { createDocxBlobFromText } from "@/lib/export/docx";

type Props = { sessionId: string };
type NoteType = "soap" | "dap" | "birp" | "girp" | "intake" | "progress" | "freeform";
type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "soap", label: "SOAP Note" },
  { value: "dap", label: "DAP Note" },
  { value: "birp", label: "BIRP Note" },
  { value: "girp", label: "GIRP Note" },
  { value: "intake", label: "Intake/Assessment" },
  { value: "progress", label: "Progress Note" },
  { value: "freeform", label: "Freeform" },
];

const AUTOSAVE_DELAY_MS = 800;

export function NoteEditor({ sessionId }: Props) {
  const { onTransferToNotes } = useSessionJob();
  const [noteType, setNoteType] = useState<NoteType>("soap");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");

  // When a transfer just happened, skip the next fetch so it doesn't overwrite
  const skipNextFetchRef = useRef(false);

  // Tracks the last value that was successfully persisted to the server.
  // Used to avoid saving when nothing has changed (prevents save loops
  // after fetch/transfer populate the editor).
  const lastSavedValueRef = useRef<string>("");

  // Debounce timer for autosave
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Current noteType ref so autosave closure always has latest value
  const noteTypeRef = useRef<NoteType>(noteType);
  noteTypeRef.current = noteType;

  // Current note ref so blur handler reads latest value without re-binding
  const noteRef = useRef<string>(note);
  noteRef.current = note;

  // ── Shared save helper ────────────────────────────────────────
  const saveNote = useCallback(
    async (content: string, type: NoteType): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/notes`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, content }),
          },
        );
        if (!response.ok) throw new Error("Save failed");
        lastSavedValueRef.current = content;
        return true;
      } catch {
        return false;
      }
    },
    [sessionId],
  );

  // ── Register transfer callback ────────────────────────────────
  const handleTransfer = useCallback(
    (content: string, incomingNoteType?: string) => {
      skipNextFetchRef.current = true;
      if (incomingNoteType) {
        const match = NOTE_TYPES.find((t) => t.value === incomingNoteType);
        if (match) setNoteType(match.value);
      }
      setNote(content);
      lastSavedValueRef.current = content;
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    onTransferToNotes(handleTransfer);
  }, [onTransferToNotes, handleTransfer]);

  // ── Fetch note on mount / noteType change ─────────────────────
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    let cancelled = false;

    async function fetchNote() {
      setLoading(true);
      setError("");
      setAutosaveStatus("idle");

      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/notes?type=${noteType}`,
          { credentials: "include" },
        );

        if (!response.ok) {
          if (!cancelled) {
            setNote("");
            lastSavedValueRef.current = "";
            setLoading(false);
          }
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          const content = data.content || "";
          setNote(content);
          lastSavedValueRef.current = content;
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNote("");
          lastSavedValueRef.current = "";
          setLoading(false);
        }
      }
    }

    fetchNote();
    return () => { cancelled = true; };
  }, [sessionId, noteType]);

  // ── Autosave debounce effect ──────────────────────────────────
  useEffect(() => {
    // Don't autosave during initial load or when content matches server
    if (loading || note === lastSavedValueRef.current) return;

    // Clear any pending timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      // Double-check: still dirty?
      if (note === lastSavedValueRef.current) return;

      setAutosaveStatus("saving");
      const ok = await saveNote(note, noteTypeRef.current);
      setAutosaveStatus(ok ? "saved" : "error");

      // Reset "Saved" indicator after 2s
      if (ok) {
        setTimeout(() => {
          setAutosaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2_000);
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [note, loading, saveNote]);

  // ── Cleanup debounce timer on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // ── Blur handler — immediate save ─────────────────────────────
  const handleBlur = useCallback(() => {
    if (loading) return;
    const current = noteRef.current;
    if (current === lastSavedValueRef.current) return;

    // Cancel pending debounce — we're saving now
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setAutosaveStatus("saving");
    void saveNote(current, noteTypeRef.current).then((ok) => {
      setAutosaveStatus(ok ? "saved" : "error");
      if (ok) {
        setTimeout(() => {
          setAutosaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2_000);
      }
    });
  }, [loading, saveNote]);

  // ── Manual save (button) ──────────────────────────────────────
  const handleSaveDraft = async () => {
    if (loading || saving) return;

    // Cancel pending autosave — manual save takes over
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setSaving(true);
    setError("");
    const ok = await saveNote(note, noteType);
    if (!ok) setError("Failed to save note");
    setSaving(false);
    setAutosaveStatus("idle");
  };

  // ── Clear handler ─────────────────────────────────────────────
  const handleClear = async () => {
    setConfirmClearOpen(false);
    setNote("");
    setSaving(true);
    setError("");
    const ok = await saveNote("", noteType);
    if (!ok) setError("Failed to clear note");
    setSaving(false);
    setAutosaveStatus("idle");
  };

  // ── Export handler ────────────────────────────────────────────
  const handleExport = async (option: string) => {
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
        try {
          const blob = await createDocxBlobFromText(note, {
            title: `${noteType.toUpperCase()} Note`,
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${noteType}-note-${sessionId}-${new Date().toISOString().split("T")[0]}.docx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success("Download started");
        } catch {
          toast.error("Failed to generate Word document");
        }
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

          const lines = doc.splitTextToSize(note, maxWidth);
          doc.setFontSize(10);

          for (let i = 0; i < lines.length; i++) {
            if (currentY + lineHeight > pageHeight - margins) {
              doc.addPage();
              currentY = margins;
            }
            doc.text(lines[i], margins, currentY);
            currentY += lineHeight;
          }

          doc.save(`${noteType}-note-${sessionId}-${new Date().toISOString().split("T")[0]}.pdf`);
        } catch {
          toast.error("Failed to generate PDF");
        }
        break;
      }
    }
  };

  // ── Autosave status label ─────────────────────────────────────
  const autosaveLabel = (() => {
    if (saving) return "Saving...";
    switch (autosaveStatus) {
      case "saving": return "Saving...";
      case "saved": return "Saved";
      case "error": return "Save failed";
      default: return null;
    }
  })();

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
            onChange={(option) => {
              void handleExport(option);
            }}
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
              data-testid="note-editor-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleBlur}
              placeholder="Start typing your note here..."
              rows={10}
              className="flex-1 min-h-[200px] resize-y rounded-lg bg-slate-50 dark:bg-slate-900 p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:outline-none"
            />
            {autosaveLabel && (
              <p
                className={`mt-2 text-xs ${
                  autosaveStatus === "error"
                    ? "text-red-500 dark:text-red-400"
                    : autosaveStatus === "saved"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-500"
                }`}
              >
                {autosaveLabel}
              </p>
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

