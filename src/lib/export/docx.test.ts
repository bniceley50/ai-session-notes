import assert from "node:assert/strict";
import { test } from "node:test";
import { createDocxBufferFromText } from "./docx";

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
