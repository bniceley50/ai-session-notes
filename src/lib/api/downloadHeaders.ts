import { safeFilename } from "@/lib/jobs/artifacts";

/**
 * Build a safe Content-Disposition header value for file downloads.
 *
 * - Sanitizes the filename via `safeFilename()` (strips path traversal,
 *   control chars, Windows-illegal chars, non-ASCII).
 * - Quotes the filename and escapes any remaining double-quotes.
 * - Strips CR/LF to prevent header injection.
 */
export function contentDisposition(rawName: string): string {
  const safe = safeFilename(rawName);
  // Double-quotes inside the value would break the header — escape them.
  const escaped = safe.replace(/"/g, '\\"');
  // Strip any CR/LF that somehow survived (defense-in-depth).
  const clean = escaped.replace(/[\r\n]/g, "");
  return `attachment; filename="${clean}"`;
}

/**
 * Standard security headers for artifact/download responses.
 *
 * Includes:
 * - Content-Disposition: attachment (force download, never inline)
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - Cache-Control: no-store (don't cache sensitive artifacts)
 * - Content-Security-Policy: sandbox (neuter scripts if browser renders)
 */
export function downloadHeaders(
  filename: string,
  contentType: string,
): Headers {
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", contentDisposition(filename));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Security-Policy", "sandbox");
  return headers;
}
