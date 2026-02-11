/**
 * Shared export utilities for session content (transcript, analysis, notes).
 *
 * Centralises clipboard, .txt download, and .pdf generation so every panel
 * uses consistent filenames, toasts, and fallback handling.
 */

import { toast } from "sonner";
import { jsPDF } from "jspdf";

// ── Types ──────────────────────────────────────────────────────────

export type ExportAction = "copy" | "txt" | "pdf";

export type ExportMeta = {
  /** e.g. "transcript", "soap-note", "progress-note" */
  filenamePrefix: string;
  sessionId: string;
};

// ── Helpers ────────────────────────────────────────────────────────

/** ISO date string for filenames (YYYY-MM-DD) */
function datestamp(): string {
  return new Date().toISOString().split("T")[0];
}

/** Build a predictable filename: {prefix}-{sessionId}-{date}.{ext} */
function buildFilename(meta: ExportMeta, ext: string): string {
  return `${meta.filenamePrefix}-${meta.sessionId}-${datestamp()}.${ext}`;
}

// ── Core actions ───────────────────────────────────────────────────

/**
 * Copy text to clipboard with proper fallback.
 *
 * Uses navigator.clipboard first, falls back to execCommand for older
 * or restricted environments. Shows toast on success or failure.
 */
export async function copyToClipboard(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  } catch {
    // Fallback for environments where clipboard API isn't available
    try {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy — try selecting the text manually");
    }
  }
}

/**
 * Download content as a .txt file via a temporary Blob URL.
 */
export function downloadTxt(content: string, meta: ExportMeta): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildFilename(meta, "txt");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Download started");
}

/**
 * Generate and download a PDF from plain-text content.
 *
 * Uses jsPDF with consistent margins, font size, and automatic pagination.
 */
export function downloadPdf(content: string, meta: ExportMeta): void {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = 20;
    const maxWidth = pageWidth - margins * 2;
    const lineHeight = 6;
    let currentY = margins;

    const lines = doc.splitTextToSize(content, maxWidth);
    doc.setFontSize(10);

    for (let i = 0; i < lines.length; i++) {
      if (currentY + lineHeight > pageHeight - margins) {
        doc.addPage();
        currentY = margins;
      }
      doc.text(lines[i], margins, currentY);
      currentY += lineHeight;
    }

    doc.save(buildFilename(meta, "pdf"));
    toast.success("PDF downloaded");
  } catch {
    toast.error("Failed to generate PDF");
  }
}

// ── Unified dispatcher ─────────────────────────────────────────────

/**
 * Single entry-point for all export actions. Each panel calls this
 * with the action key and content.
 *
 * Returns early with a warning toast if content is empty.
 */
export function handleExportAction(
  action: ExportAction,
  content: string,
  meta: ExportMeta,
): void {
  if (!content || content.trim() === "") {
    toast.warning("No content available to export yet.");
    return;
  }

  switch (action) {
    case "copy":
      void copyToClipboard(content);
      break;
    case "txt":
      downloadTxt(content, meta);
      break;
    case "pdf":
      downloadPdf(content, meta);
      break;
  }
}
