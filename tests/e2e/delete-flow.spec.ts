import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import path from "path";

/**
 * Delete-flow E2E test.
 *
 * Proves that deleting a completed job:
 *   - Shows a "Job deleted." notice
 *   - Resets AudioInput so user can re-upload
 *   - Clears transcript from the page
 *
 * The stub pipeline completes near-instantly. We let it finish fully,
 * then click the "Delete job" button that appears in terminal states.
 *
 * Requires:
 *   AI_ENABLE_STUB_APIS=1  AI_ENABLE_REAL_APIS=0  ALLOW_DEV_LOGIN=1
 */

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/silence-2s.mp3");
const STUB_TRANSCRIPT_MARKER = "STUB Transcript (Demo Mode)";

test.describe("Delete Flow", () => {
  test("delete after completion shows notice and resets UI", async ({
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

    // ── 4. Wait for pipeline to complete (transcript visible) ──
    // Stub transcript marker appears once transcription finishes.
    const transcriptText = page.getByText(STUB_TRANSCRIPT_MARKER);
    await expect(transcriptText).toBeVisible({ timeout: 30_000 });

    // ── 5. Wait for "Delete job" button (terminal state) ───────
    const deleteBtn = page.getByRole("button", { name: "Delete job" });
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();

    // ── 6. Assert: "Job deleted." notice appears ───────────────
    const notice = page.getByText("Job deleted.").first();
    await expect(notice).toBeVisible({ timeout: 5_000 });

    // ── 7. Assert: UI reset — upload controls are available ────
    const uploadArea = page.getByText("Upload audio/video file");
    await expect(uploadArea).toBeVisible({ timeout: 5_000 });

    // ── 8. Assert: transcript cleared from page ────────────────
    const transcriptMarker = page.getByText(STUB_TRANSCRIPT_MARKER);
    await expect(transcriptMarker).not.toBeVisible({ timeout: 2_000 });
  });
});
