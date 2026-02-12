/**
 * Stitch multiple transcript chunks into a single transcript.
 *
 * When audio is split with overlap (e.g. 10-second overlap between chunks),
 * Whisper will transcribe the overlapping segment in both chunks.
 * This module deduplicates the overlap by matching the trailing words
 * of chunk[i] against the leading words of chunk[i+1].
 *
 * If no overlap is detected, chunks are joined with a space (graceful
 * degradation — a few duplicated words are acceptable for clinical notes).
 */

/**
 * Normalize text for comparison: lowercase, collapse whitespace,
 * strip leading/trailing punctuation from each word.
 */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, "");
}

/**
 * Find the overlap point between two transcript chunks.
 *
 * Extracts the last `overlapWords` words from `prev` and searches for
 * that phrase within the first `searchWindow` words of `next`.
 *
 * Returns the word-index in `next` where the non-overlapping portion
 * begins, or 0 if no overlap is detected.
 */
function findOverlapIndex(
  prev: string,
  next: string,
  overlapWords: number,
  searchWindow: number,
): number {
  const prevWords = prev.split(/\s+/).filter(Boolean);
  const nextWords = next.split(/\s+/).filter(Boolean);

  if (prevWords.length === 0 || nextWords.length === 0) return 0;

  // Take up to `overlapWords` from the end of prev
  const tailCount = Math.min(overlapWords, prevWords.length);
  const tail = prevWords.slice(-tailCount).map(normalizeWord);

  // Search within the first `searchWindow` words of next
  const windowSize = Math.min(searchWindow, nextWords.length);

  // Try to match the full tail first, then shrink if no match
  for (let len = tail.length; len >= 3; len--) {
    const needle = tail.slice(-len);

    for (let i = 0; i <= windowSize - len; i++) {
      const candidate = nextWords.slice(i, i + len).map(normalizeWord);

      if (needle.every((w, idx) => w === candidate[idx])) {
        // Found overlap — skip past the matched region in next
        return i + len;
      }
    }
  }

  return 0;
}

/**
 * Stitch an array of transcript text chunks into a single string.
 *
 * @param texts          - Ordered transcript chunks
 * @param overlapWords   - Max trailing words to check for overlap (default 8)
 * @param searchWindow   - Max leading words of next chunk to search (default 50)
 */
export function stitchTranscripts(
  texts: string[],
  overlapWords = 8,
  searchWindow = 50,
): string {
  const nonEmpty = texts.filter((t) => t.trim().length > 0);
  if (nonEmpty.length === 0) return "";
  if (nonEmpty.length === 1) return nonEmpty[0].trim();

  let result = nonEmpty[0].trim();

  for (let i = 1; i < nonEmpty.length; i++) {
    const next = nonEmpty[i].trim();
    const skipWords = findOverlapIndex(result, next, overlapWords, searchWindow);

    if (skipWords > 0) {
      const nextWords = next.split(/\s+/).filter(Boolean);
      const remaining = nextWords.slice(skipWords).join(" ");
      if (remaining) {
        result += " " + remaining;
      }
    } else {
      result += " " + next;
    }
  }

  return result;
}
