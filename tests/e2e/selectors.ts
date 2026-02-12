/**
 * Centralised test-id selectors for E2E specs.
 *
 * Every `getByTestId("…")` string in our Playwright tests should come
 * from this file. If a component renames a `data-testid`, update it
 * here and all specs follow automatically.
 *
 * Naming convention:  {category}-{panel?}-{purpose}
 *   action-*       interactive buttons / triggers
 *   panel-*        panel-level containers / headers
 *   status-*       status indicators (chips, badges)
 *   content-*      read-only output regions
 *   prompt-*       user-facing prompts / CTAs
 */

export const TID = {
  // ── Actions ─────────────────────────────────────────────
  action: {
    cancelJob: "action-cancel-job",
    cancelAnalysis: "action-cancel-analysis",
    openDeleteDialog: "action-open-delete-dialog",
    cancelDeleteDialog: "action-cancel-delete-dialog",
    confirmDeleteJob: "action-confirm-delete-job",
    uploadFile: "action-upload-file",
    textMode: "action-text-mode",
    submitText: "action-submit-text",
    generateNote: "action-generate-note",
    transferNotes: "action-transfer-notes",
  },

  // ── Panels ──────────────────────────────────────────────
  panel: {
    audio: "panel-header-audio",
    transcript: "panel-header-transcript",
    analysis: "panel-header-analysis",
  },

  // ── Status chips ────────────────────────────────────────
  status: {
    audio: "status-chip-audio",
    transcript: "status-chip-transcript",
    analysis: "status-chip-analysis",
  },

  // ── Content regions ─────────────────────────────────────
  content: {
    transcript: "transcript-content",
    analysisDraft: "analysis-draft-content",
    noteEditorTextarea: "note-editor-textarea",
    textSummaryInput: "input-text-summary",
  },

  // ── Prompts ─────────────────────────────────────────────
  prompt: {
    analysisReady: "analysis-ready-prompt",
  },
} as const;
