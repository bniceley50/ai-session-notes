import assert from "node:assert/strict";
import { test } from "node:test";
import { safePathSegment, safeFilename } from "@/lib/jobs/artifacts";

// ---------------------------------------------------------------------------
// safePathSegment — must reject anything that could escape a directory
// ---------------------------------------------------------------------------

test("safePathSegment: accepts valid alphanumeric-dash-underscore", () => {
  assert.equal(safePathSegment("job_abc-123"), "job_abc-123");
});

test("safePathSegment: rejects directory traversal (../)", () => {
  assert.throws(() => safePathSegment("../../etc/passwd"), /invalid path segment/);
});

test("safePathSegment: rejects backslash traversal (..\\)", () => {
  assert.throws(() => safePathSegment("..\\..\\windows\\system32"), /invalid path segment/);
});

test("safePathSegment: rejects empty string", () => {
  assert.throws(() => safePathSegment(""), /invalid path segment/);
});

test("safePathSegment: rejects slashes", () => {
  assert.throws(() => safePathSegment("foo/bar"), /invalid path segment/);
  assert.throws(() => safePathSegment("foo\\bar"), /invalid path segment/);
});

test("safePathSegment: rejects dots-only", () => {
  assert.throws(() => safePathSegment(".."), /invalid path segment/);
  assert.throws(() => safePathSegment("."), /invalid path segment/);
});

test("safePathSegment: rejects spaces and special chars", () => {
  assert.throws(() => safePathSegment("hello world"), /invalid path segment/);
  assert.throws(() => safePathSegment("file<name>"), /invalid path segment/);
  assert.throws(() => safePathSegment('file"name'), /invalid path segment/);
});

test("safePathSegment: rejects URL-encoded traversal", () => {
  // If decoded elsewhere, %2e%2e%2f becomes ../  — segment must still reject
  assert.throws(() => safePathSegment("%2e%2e%2f"), /invalid path segment/);
});

// ---------------------------------------------------------------------------
// safeFilename — must sanitize to a safe filename, never empty
// ---------------------------------------------------------------------------

test("safeFilename: passes through simple filenames", () => {
  assert.equal(safeFilename("recording.webm"), "recording.webm");
});

test("safeFilename: strips directory traversal prefix", () => {
  const result = safeFilename("../../etc/passwd");
  assert.ok(!result.includes(".."));
  assert.ok(!result.includes("/"));
});

test("safeFilename: strips Windows illegal characters", () => {
  const result = safeFilename('file<>:"/\\|?*name.txt');
  assert.ok(!result.includes("<"));
  assert.ok(!result.includes(">"));
  assert.ok(!result.includes(":"));
  assert.ok(!result.includes('"'));
  assert.ok(!result.includes("\\"));
  assert.ok(!result.includes("|"));
  assert.ok(!result.includes("?"));
  assert.ok(!result.includes("*"));
});

test("safeFilename: strips control characters", () => {
  const result = safeFilename("file\x00\x01\x1fname.txt");
  assert.ok(!result.includes("\x00"));
  assert.ok(!result.includes("\x01"));
  assert.ok(!result.includes("\x1f"));
});

test("safeFilename: strips trailing dots and spaces", () => {
  const result = safeFilename("file...");
  assert.ok(!result.endsWith("."));
});

test("safeFilename: returns upload.bin for all-unicode input", () => {
  assert.equal(safeFilename("\u{1F600}\u{1F601}\u{1F602}"), "upload.bin");
});

test("safeFilename: returns upload.bin for empty string", () => {
  assert.equal(safeFilename(""), "upload.bin");
});

test("safeFilename: returns upload.bin for whitespace-only", () => {
  assert.equal(safeFilename("   "), "upload.bin");
});
