import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Write a file atomically: content → temp file → rename to final path.
 *
 * Guarantees:
 * - The final path is never partially written (readers see old or new, never mid-write).
 * - On error, best-effort cleanup of the temp file; final path is untouched.
 *
 * The temp file is created in the same directory as the final path so
 * `rename()` is atomic (same filesystem).
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
  encoding: BufferEncoding = "utf8",
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const suffix = crypto.randomBytes(6).toString("hex");
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${suffix}`);

  try {
    await fs.writeFile(tmpPath, content, encoding);
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup — don't mask the original error
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}
