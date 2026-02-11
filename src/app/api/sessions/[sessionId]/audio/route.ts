import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/errors";
import { ensureSessionOwnership } from "@/lib/sessions/ownership";
import { safePathSegment } from "@/lib/jobs/artifacts";
import {
  getSessionAudioDir,
  sanitizeOriginalName,
  writeAudioMetadata,
  type AudioArtifact,
} from "@/lib/jobs/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = {
  // Audio formats (Whisper-native)
  "audio/webm": ".webm",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/m4a": ".m4a",
  "audio/x-mpegurl": ".m4a",
  // Video formats (Whisper accepts mp4/webm/mpeg natively)
  "video/webm": ".webm",
  "video/mp4": ".mp4",
  "video/mpeg": ".mpeg",
  "video/quicktime": ".mov",
  "application/octet-stream": ".bin", // Fallback for generic uploads
};

class ByteLimitTransform extends Transform {
  private total = 0;
  private readonly limit: number;

  constructor(limit: number) {
    super();
    this.limit = limit;
  }

  get bytes(): number {
    return this.total;
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void
  ): void {
    this.total += chunk.length;
    if (this.total > this.limit) {
      const error = new Error("PAYLOAD_TOO_LARGE");
      (error as Error & { code?: string }).code = "PAYLOAD_TOO_LARGE";
      callback(error);
      return;
    }
    callback(null, chunk);
  }
}

const normalizeMime = (value: string): string => value.split(";")[0]?.trim().toLowerCase();

const isAutocreateAllowed = (): boolean =>
  process.env.ALLOW_SESSION_AUTOCREATE === "1" && process.env.NODE_ENV !== "production";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId: sessionIdParam } = await context.params;
  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return jsonError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const sessionId = typeof sessionIdParam === "string" ? sessionIdParam.trim() : "";
  if (!sessionId) {
    return jsonError(400, "BAD_REQUEST", "sessionId required.");
  }

  try {
    safePathSegment(sessionId);
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid sessionId.");
  }

  const ownership = await ensureSessionOwnership(
    sessionId,
    session.sub,
    isAutocreateAllowed(),
    session.practiceId
  );
  if (!ownership) {
    return jsonError(404, "NOT_FOUND", "Session not found or not accessible.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES) {
      return jsonError(413, "PAYLOAD_TOO_LARGE", "File too large.");
    }
  }

  if (!request.body) {
    return jsonError(400, "BAD_REQUEST", "Audio body required.");
  }

  const ct = request.headers.get("content-type") ?? "";
  const base = normalizeMime(ct);

  // Accept only MIME types explicitly listed in the allowlist (Whisper-compatible formats).
  const allowedMimes = new Set(Object.keys(MIME_EXTENSION));
  if (!allowedMimes.has(base)) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", `Unsupported media type: ${ct}`);
  }

  const mime = base;
  const extFromMime = MIME_EXTENSION[mime] ?? ".webm";

  const url = new URL(request.url);
  const rawFilename = url.searchParams.get("filename") ?? "";
  const sanitizedFilename = rawFilename ? sanitizeOriginalName(rawFilename) : "";
  const allowedExts = new Set(Object.values(MIME_EXTENSION));
  const extFromName = sanitizedFilename ? path.extname(sanitizedFilename).toLowerCase() : "";
  const ext = allowedExts.has(extFromName) ? extFromName : extFromMime;

  let filename = sanitizedFilename;
  if (!filename) {
    filename = `audio${ext}`;
  } else if (!extFromName) {
    filename = `${filename}${ext}`;
  } else if (extFromName !== ext) {
    filename = `${filename.slice(0, -extFromName.length)}${ext}`;
  }

  const artifactId = `aud_${randomUUID()}`;
  const storedName = `${artifactId}${ext}`;
  const audioDir = getSessionAudioDir(sessionId);
  await fs.mkdir(audioDir, { recursive: true });

  const destPath = path.join(audioDir, storedName);
  const limiter = new ByteLimitTransform(MAX_UPLOAD_BYTES);

  try {
    const body = request.body as unknown as NodeReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(body), limiter, createWriteStream(destPath, { flags: "wx" }));
  } catch (error: unknown) {
    await fs.unlink(destPath).catch(() => {});
    const code = (error as { code?: string })?.code;
    if (code === "PAYLOAD_TOO_LARGE" || (error as Error)?.message === "PAYLOAD_TOO_LARGE") {
      return jsonError(413, "PAYLOAD_TOO_LARGE", "File too large.");
    }
    return jsonError(500, "INTERNAL", "Unable to upload audio.");
  }

  if (limiter.bytes <= 0) {
    await fs.unlink(destPath).catch(() => {});
    return jsonError(400, "BAD_REQUEST", "Audio body required.");
  }

  const createdAt = new Date().toISOString();
  const meta: AudioArtifact = {
    artifactId,
    sessionId,
    filename,
    storedName,
    mime,
    bytes: limiter.bytes,
    createdAt,
  };

  await writeAudioMetadata(meta);

  return NextResponse.json({
    artifactId: meta.artifactId,
    filename: meta.filename,
    mime: meta.mime,
    bytes: meta.bytes,
    createdAt: meta.createdAt,
    downloadUrl: `/api/sessions/${encodeURIComponent(sessionId)}/audio/${encodeURIComponent(
      meta.artifactId
    )}`,
  });
}



