import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import path from "path";
import { TID } from "./selectors";

/**
 * Core-loop happy-path E2E test.
 *
 * Proves the full pipeline works end-to-end in stub mode:
 *   dev-login → open session → upload audio → wait for transcript →
 *   Generate SOAP Note → Transfer to Notes → verify NoteEditor content
 *
 * Requires:
 *   AI_ENABLE_STUB_APIS=1  AI_ENABLE_REAL_APIS=0  ALLOW_DEV_LOGIN=1
 * (All set via playwright.config.ts webServer.env)
 */

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/silence-2s.mp3");

// Stub pipeline produces these known strings
const STUB_TRANSCRIPT_MARKER = "STUB Transcript (Demo Mode)";
const STUB_DRAFT_MARKER = "SOAP Note (Demo Mode)";

test.describe("Core Loop — Happy Path", () => {
  test("upload → transcribe → generate → transfer to notes", async ({
    page,
  }) => {
    // Capture console errors & failed requests for debugging
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on("requestfailed", (req) => {
      consoleLogs.push(`[REQUEST FAILED] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    });

    // ── 1. Dev-login bypass ──────────────────────────────────────
    // Navigate to dev-login so the session cookie is set in the
    // browser context (page.request.get doesn't share cookies with page).
    await page.goto("/api/auth/dev-login");
    // Dev-login redirects to / — wait for that to land
    await page.waitForURL("/");

    // ── 2. Navigate directly to a new session ────────────────────
    // Generate UUID ourselves to avoid fragile client-side redirect timing
    const sessionId = randomUUID();
    await page.goto(`/sessions/${sessionId}`);

    // Verify the session page loaded (Audio Input heading present)
    await expect(page.getByText("Audio Input")).toBeVisible({ timeout: 15_000 });

    // ── 3. Upload the silent audio fixture ───────────────────────
    // The file input is hidden; we interact with it directly via
    // setInputFiles rather than clicking the "Upload audio/video file" button.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);

    // After file is selected, click the "Upload" button that appears
    const uploadBtn = page.getByRole("button", { name: "Upload" });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
    await uploadBtn.click();

    // ── 4. Wait for transcript to appear ─────────────────────────
    // Stub pipeline writes transcript at 40% progress, then continues.
    // We wait for known stub text to appear in the TranscriptViewer.
    const transcriptText = page.getByText(STUB_TRANSCRIPT_MARKER);
    await expect(transcriptText).toBeVisible({ timeout: 45_000 });

    // ── 4b. Assert: status chip shows "Complete" ────────────────
    // After the stub pipeline finishes, the transcript panel's chip
    // should display "Complete".
    const completeChip = page.getByTestId(TID.status.transcript).filter({ hasText: "Complete" });
    await expect(completeChip).toBeVisible({ timeout: 10_000 });

    // ── 5. Wait for the "Generate" prompt ────────────────────────
    // After transcription completes, AIAnalysisViewer shows
    // "Transcript ready. Choose a note type and generate."
    const readyText = page.getByText("Transcript ready");
    await expect(readyText).toBeVisible({ timeout: 30_000 });

    // Note type defaults to SOAP — click "Generate SOAP Note"
    const generateBtn = page.getByTestId(TID.action.generateNote);
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeEnabled();
    // Scroll into view and use a normal click (not force) so Playwright
    // waits for actionability and React's synthetic events fire properly.
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click();

    // ── 6. Wait for the draft to appear ──────────────────────────
    // The stub draft includes "SOAP Note (Demo Mode)" as the heading.
    // First check for intermediate states (starting, progress bar, or error)
    // to provide better diagnostics if something goes wrong.
    const draftText = page.getByText(STUB_DRAFT_MARKER);
    await expect(draftText).toBeVisible({ timeout: 30_000 });

    // ── 7. Transfer to Notes ─────────────────────────────────────
    const transferBtn = page.getByTestId(TID.action.transferNotes);
    await expect(transferBtn).toBeVisible();
    await transferBtn.scrollIntoViewIfNeeded();
    await transferBtn.click();

    // After transfer the button text changes to "Transferred!"
    await expect(
      page.getByRole("button", { name: "Transferred!" }),
    ).toBeVisible({ timeout: 5_000 });

    // ── 8. Verify the NoteEditor received the content ────────────
    // The NoteEditor has a <textarea> with the transferred draft.
    const noteTextarea = page.getByTestId(TID.content.noteEditorTextarea);
    await expect(noteTextarea).toBeVisible();
    // Escape regex special chars (parens) in the marker string
    const draftRegex = new RegExp(STUB_DRAFT_MARKER.replace(/[()]/g, "\\$&"));
    await expect(noteTextarea).toHaveValue(draftRegex, {
      timeout: 5_000,
    });

    // ── 9. Assert: all three Export dropdowns are visible ───────
    // After full pipeline completion, every panel should offer its
    // export dropdown so the user can copy or download content.
    await expect(page.getByTestId(TID.export.transcript)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(TID.export.analysis)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(TID.export.notes)).toBeVisible({ timeout: 5_000 });
  });
});
