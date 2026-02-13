import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createDocxBufferFromText, createDocxBlobFromText } from "./docx";

describe("docx export", () => {
  // ── Buffer generation ───────────────────────────────────────

  test("createDocxBufferFromText returns a valid docx zip buffer", async () => {
    const buffer = await createDocxBufferFromText("Subjective\nObjective\nAssessment\nPlan");
    assert.ok(buffer.length > 0);

    // ZIP magic number: "PK"
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);

    // DOCX package should include the main document XML entry name.
    const asText = buffer.toString("utf8");
    assert.ok(asText.includes("word/document.xml"));
  });

  test("createDocxBufferFromText supports optional title", async () => {
    const buffer = await createDocxBufferFromText("Clinical note body", { title: "SOAP Note" });
    assert.ok(buffer.length > 0);
  });

  // ── Blob generation (client-side path) ──────────────────────

  test("createDocxBlobFromText returns a Blob with correct MIME type", async () => {
    const blob = await createDocxBlobFromText("Test clinical note");
    assert.ok(blob.size > 0);
    assert.equal(
      blob.type,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  // ── Edge cases ──────────────────────────────────────────────

  test("handles empty string without throwing", async () => {
    const buffer = await createDocxBufferFromText("");
    assert.ok(buffer.length > 0);
    // Should still produce a valid ZIP
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  });

  test("handles multiline content with carriage returns", async () => {
    const buffer = await createDocxBufferFromText("Line 1\r\nLine 2\r\nLine 3");
    assert.ok(buffer.length > 0);
  });
});
