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

  // ── Export dropdowns ──────────────────────────────────────
  export: {
    transcript: "export-transcript",
    analysis: "export-analysis",
    notes: "export-notes",
  },

  // ── Content regions ─────────────────────────────────────
  content: {
    transcript: "transcript-content",
    analysisDraft: "analysis-draft-content",
    noteEditorTextarea: "note-editor-textarea",
  },

  // ── Prompts ─────────────────────────────────────────────
  prompt: {
    analysisReady: "analysis-ready-prompt",
  },
} as const;
