import path from "node:path";

export const ARTIFACTS_ROOT = ".artifacts";

export function getArtifactsDir(sessionId: string, jobId: string): string {
  return path.resolve(ARTIFACTS_ROOT, sessionId, jobId);
}
