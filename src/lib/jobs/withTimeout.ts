/**
 * Race a promise against a timeout.
 *
 * Uses AbortController so callers that forward the signal
 * (e.g. OpenAI / Anthropic SDK `{ signal }`) can truly cancel
 * the underlying HTTP request instead of just ignoring the result.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const { signal } = controller;

  const timeout = new Promise<never>((_, reject) => {
    const t = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    // Don't block Node from exiting if this is the only thing left
    if (typeof t === "object" && "unref" in t) t.unref();
  });

  try {
    return await Promise.race([fn(signal), timeout]);
  } finally {
    // Clean up: abort if the fn finished before the timeout
    controller.abort();
  }
}
