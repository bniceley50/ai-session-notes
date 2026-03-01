import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contentDisposition, downloadHeaders } from "@/lib/api/downloadHeaders";

describe("contentDisposition", () => {
  // ── Basic usage ────────────────────────────────────────────────
  test("wraps a simple filename in attachment + quotes", () => {
    assert.equal(
      contentDisposition("report.txt"),
      'attachment; filename="report.txt"',
    );
  });

  // ── CRLF injection prevention ─────────────────────────────────
  test("strips \\r\\n from filename (header injection)", () => {
    const value = contentDisposition("evil\r\nX-Injected: true");
    assert.ok(!value.includes("\r"), "must not contain CR");
    assert.ok(!value.includes("\n"), "must not contain LF");
  });

  test("strips \\n alone from filename", () => {
    const value = contentDisposition("evil\nX-Injected: true");
    assert.ok(!value.includes("\n"));
  });

  // ── Quote escaping ────────────────────────────────────────────
  test('escapes double quotes inside filename', () => {
    const value = contentDisposition('file"name.txt');
    // safeFilename strips quotes, so this should not contain unescaped "
    assert.ok(!value.includes('file"name'), "raw quote must not survive");
  });

  // ── Path traversal ────────────────────────────────────────────
  test("../  does not survive sanitization", () => {
    const value = contentDisposition("../../etc/passwd");
    assert.ok(!value.includes(".."), "traversal must be stripped");
    assert.ok(!value.includes("/"), "slashes must be stripped");
  });

  test("..\\  backslashes are stripped from filename", () => {
    const value = contentDisposition("..\\..\\windows\\system32");
    // Backslashes must be gone (path separator on Windows)
    assert.ok(!value.includes("\\"), "backslashes must be stripped");
    // The result is a flat filename — no directory component survives
    assert.ok(!value.includes("/"), "forward slashes must not appear");
  });

  // ── Control characters ────────────────────────────────────────
  test("control characters are stripped", () => {
    const value = contentDisposition("file\x00\x01\x1fname.txt");
    // No control chars in the resulting header value
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      assert.ok(code >= 0x20, `char at ${i} (0x${code.toString(16)}) is a control char`);
    }
  });

  // ── Empty / garbage input ─────────────────────────────────────
  test("empty string falls back to upload.bin", () => {
    assert.equal(
      contentDisposition(""),
      'attachment; filename="upload.bin"',
    );
  });

  test("all-emoji input falls back to upload.bin", () => {
    assert.equal(
      contentDisposition("\u{1F600}\u{1F601}"),
      'attachment; filename="upload.bin"',
    );
  });
});

describe("downloadHeaders", () => {
  test("sets all required security headers", () => {
    const headers = downloadHeaders("test.txt", "text/plain; charset=utf-8");

    assert.equal(headers.get("Content-Type"), "text/plain; charset=utf-8");
    assert.equal(
      headers.get("Content-Disposition"),
      'attachment; filename="test.txt"',
    );
    assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(headers.get("Cache-Control"), "no-store");
    assert.equal(headers.get("Content-Security-Policy"), "sandbox");
  });

  test("additional headers can be appended after creation", () => {
    const headers = downloadHeaders("audio.webm", "audio/webm");
    headers.set("Content-Length", "12345");

    assert.equal(headers.get("Content-Length"), "12345");
    assert.equal(headers.get("Content-Disposition"), 'attachment; filename="audio.webm"');
  });
});
