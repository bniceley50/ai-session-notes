import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calculateChunkBoundaries } from "@/lib/jobs/ffmpeg";

/**
 * Unit tests for FFmpeg chunking logic.
 *
 * Note: `splitAudioIntoChunks` and `checkFfmpeg` rely on the system
 * FFmpeg binary and are not unit-tested here. The pure boundary
 * calculation logic is fully testable.
 */

describe("calculateChunkBoundaries", () => {
  // ── Basic splitting ────────────────────────────────────────────

  test("short audio (< 1 chunk) → single boundary", () => {
    // 5 minutes of audio, 10-minute chunks
    const result = calculateChunkBoundaries(300, 10, 10);
    assert.equal(result.length, 1);
    assert.equal(result[0].start, 0);
    assert.equal(result[0].duration, 300);
  });

  test("audio exactly one chunk → single boundary", () => {
    // 10 minutes = 600 seconds
    const result = calculateChunkBoundaries(600, 10, 10);
    assert.equal(result.length, 1);
    assert.equal(result[0].start, 0);
    assert.equal(result[0].duration, 600);
  });

  test("audio slightly over one chunk → two boundaries", () => {
    // 11 minutes = 660 seconds, 10-minute chunks, 10s overlap
    // step = 600 - 10 = 590
    // chunk 0: start=0, duration=600
    // chunk 1: start=590, duration=70
    const result = calculateChunkBoundaries(660, 10, 10);
    assert.equal(result.length, 2);

    assert.equal(result[0].start, 0);
    assert.equal(result[0].duration, 600);

    assert.equal(result[1].start, 590);
    assert.equal(result[1].duration, 70); // 660 - 590
  });

  test("30-minute audio → correct number of chunks", () => {
    // 1800 seconds, 10-minute chunks (600s), 10s overlap
    // step = 590
    // chunks: 0, 590, 1180, 1770
    const result = calculateChunkBoundaries(1800, 10, 10);

    // chunk 0: start=0, dur=600
    // chunk 1: start=590, dur=600
    // chunk 2: start=1180, dur=600
    // chunk 3: start=1770, dur=30
    assert.equal(result.length, 4);

    assert.equal(result[0].start, 0);
    assert.equal(result[0].duration, 600);

    assert.equal(result[3].start, 1770);
    assert.equal(result[3].duration, 30);
  });

  // ── Overlap mechanics ──────────────────────────────────────────

  test("overlap is reflected in chunk start times", () => {
    // 25 minutes = 1500 seconds, 10-minute chunks, 10s overlap
    // step = 590
    const result = calculateChunkBoundaries(1500, 10, 10);

    // Each chunk (except first) should start 590s after the previous
    for (let i = 1; i < result.length; i++) {
      assert.equal(result[i].start - result[i - 1].start, 590);
    }
  });

  test("zero overlap → no overlap between chunks", () => {
    // 20 minutes = 1200 seconds, 10-minute chunks, 0s overlap
    // step = 600
    const result = calculateChunkBoundaries(1200, 10, 0);
    assert.equal(result.length, 2);

    assert.equal(result[0].start, 0);
    assert.equal(result[0].duration, 600);

    assert.equal(result[1].start, 600);
    assert.equal(result[1].duration, 600);
  });

  // ── Edge cases ─────────────────────────────────────────────────

  test("zero duration → empty array", () => {
    const result = calculateChunkBoundaries(0, 10, 10);
    assert.equal(result.length, 0);
  });

  test("negative duration → empty array", () => {
    const result = calculateChunkBoundaries(-100, 10, 10);
    assert.equal(result.length, 0);
  });

  test("overlap >= chunk size → single chunk (whole file)", () => {
    // 30s audio, 10s chunks, 15s overlap → step = -5 → fallback
    const result = calculateChunkBoundaries(30, 0.167, 15); // 0.167 min ≈ 10s
    assert.equal(result.length, 1);
    assert.equal(result[0].start, 0);
    assert.equal(result[0].duration, 30);
  });

  // ── 60-minute session (realistic scenario) ─────────────────────

  test("60-minute session produces correct chunk count", () => {
    // 3600 seconds, 10-minute chunks, 10s overlap
    // step = 590
    // chunks start at: 0, 590, 1180, 1770, 2360, 2950, 3540
    const result = calculateChunkBoundaries(3600, 10, 10);

    // All chunks except possibly the last should be 600s
    for (let i = 0; i < result.length - 1; i++) {
      assert.equal(result[i].duration, 600, `chunk ${i} should be 600s`);
    }

    // Last chunk should cover remaining audio
    const lastChunk = result[result.length - 1];
    assert.ok(lastChunk.duration > 0, "last chunk should have positive duration");
    assert.ok(
      lastChunk.start + lastChunk.duration === 3600,
      "last chunk should reach end of audio",
    );
  });
});
