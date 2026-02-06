import path from "node:path";

export const ARTIFACTS_ROOT = ".artifacts";

const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const WINDOWS_ILLEGAL_PATTERN = /[<>:"/\\|?*\u0000-\u001f]/g;

export function safePathSegment(segment: string): string {
  if (!PATH_SEGMENT_PATTERN.test(segment)) {
    throw new Error("invalid path segment");
  }
  return segment;
}

export function safeFilename(name: string): string {
  const base = path.basename(name);
  const stripped = base.replace(WINDOWS_ILLEGAL_PATTERN, "").trim();
  const normalized = stripped.replace(/[. ]+$/, "").trim();
  const asciiOnly = normalized.replace(/[^\x20-\x7E]/g, "").trim();
  return asciiOnly || "upload.bin";
}

export function getJobArtifactsDir(
  practiceId: string,
  sessionId: string,
  jobId: string
): string {
  return path.resolve(
    ARTIFACTS_ROOT,
    safePathSegment(practiceId),
    safePathSegment(sessionId),
    safePathSegment(jobId)
  );
}
