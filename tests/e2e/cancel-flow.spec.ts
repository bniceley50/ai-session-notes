import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import path from "path";

/**
 * Cancel-flow E2E test.
 *
 * Proves that cancelling a job mid-run:
 *   - Stops processing UI
 *   - Cancel button locks (disabled) during in-flight action
 *   - Shows a "Job cancelled" notice
 *   - Resets AudioInput so user can re-upload
 *
 * Uses the same stub mode as core-loop. The stub pipeline completes
 * near-instantly, but the 2s poll interval means the UI stays in
 * "processing" state long enough to click Cancel.
 *
 * Requires:
 *   AI_ENABLE_STUB_APIS=1  AI_ENABLE_REAL_APIS=0  ALLOW_DEV_LOGIN=1
 */

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/silence-2s.mp3");

test.describe("Cancel Flow", () => {
  test("cancel during transcription shows notice and resets UI", async ({
    page,
  }) => {
    // ── 1. Dev-login ──────────────────────────────────────────
    await page.goto("/api/auth/dev-login");
    await page.waitForURL("/");

    // ── 2. Navigate to a fresh session ────────────────────────
    const sessionId = randomUUID();
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByText("Audio Input")).toBeVisible({ timeout: 15_000 });

    // ── 3. Upload fixture ─────────────────────────────────────
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);

    const uploadBtn = page.getByRole("button", { name: "Upload" });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
    await uploadBtn.click();

    // ── 4. Wait for processing to start, then click Cancel ────
    // After upload, AudioInput enters "processing" state and shows Cancel.
    // The stub pipeline completes fast, but the 2s poll interval means
    // the AI Analysis panel also shows a Cancel button during transcription.
    // We look for either Cancel button and click whichever appears first.
    const cancelBtn = page.getByRole("button", { name: "Cancel" }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    // ── 4b. Assert: action lock — Cancel button gone after click ──
    // After clicking, the button becomes disabled ("Cancelling…") then
    // disappears as the UI resets. Verify it's no longer clickable.
    await expect(cancelBtn).not.toBeVisible({ timeout: 2_000 });

    // ── 5. Assert: "Job cancelled" notice appears ─────────────
    // Notice shows in both AudioInput and AIAnalysisViewer panels;
    // check that at least one is visible.
    const notice = page.getByText("Job cancelled.").first();
    await expect(notice).toBeVisible({ timeout: 5_000 });

    // ── 6. Assert: UI reset — upload controls are available ───
    // After cancel, AudioInput resets to idle. The file input and
    // "Upload audio/video file" button (or Record button) should reappear.
    const uploadArea = page.getByText("Upload audio/video file");
    await expect(uploadArea).toBeVisible({ timeout: 5_000 });

    // ── 7. Assert: no transcript visible (cancelled before it could show)
    // The stub transcript marker should NOT be on the page
    const transcriptMarker = page.getByText("STUB Transcript (Demo Mode)");
    await expect(transcriptMarker).not.toBeVisible({ timeout: 2_000 });
  });
});
