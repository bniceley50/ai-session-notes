import fs from "node:fs/promises";
import path from "node:path";
import { ARTIFACTS_ROOT, safeFilename, safePathSegment } from "@/lib/jobs/artifacts";

export type AudioArtifact = {
  artifactId: string;
  sessionId: string;
  filename: string;
  storedName: string;
  mime: string;
  bytes: number;
  createdAt: string;
};

export const getSessionAudioDir = (sessionId: string): string =>
  path.resolve(ARTIFACTS_ROOT, safePathSegment(sessionId), "audio");

export const getAudioMetadataPath = (sessionId: string, artifactId: string): string =>
  path.resolve(getSessionAudioDir(sessionId), `${safePathSegment(artifactId)}.json`);

export const getAudioFilePath = (sessionId: string, storedName: string): string =>
  path.resolve(getSessionAudioDir(sessionId), storedName);

export const sanitizeOriginalName = (filename: string): string => safeFilename(filename);

export const writeAudioMetadata = async (meta: AudioArtifact): Promise<void> => {
  const audioDir = getSessionAudioDir(meta.sessionId);
  await fs.mkdir(audioDir, { recursive: true });
  await fs.writeFile(
    getAudioMetadataPath(meta.sessionId, meta.artifactId),
    JSON.stringify(meta, null, 2),
    "utf8"
  );
};

export const readAudioMetadata = async (
  sessionId: string,
  artifactId: string
): Promise<AudioArtifact | null> => {
  try {
    const raw = await fs.readFile(getAudioMetadataPath(sessionId, artifactId), "utf8");
    const data = JSON.parse(raw) as AudioArtifact;
    if (!data || typeof data !== "object") return null;
    if (typeof data.artifactId !== "string" || typeof data.sessionId !== "string") return null;
    return data;
  } catch {
    return null;
  }
};



