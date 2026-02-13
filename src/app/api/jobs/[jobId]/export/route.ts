import fs from "node:fs/promises";
import { requireJobOwner } from "@/lib/api/requireJobOwner";
import { jsonError } from "@/lib/api/errors";
import { getJobExportPath } from "@/lib/jobs/status";
import { createDocxBufferFromText } from "@/lib/export/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * GET /api/jobs/[jobId]/export
 *
 * Returns the export (clinical note) for a completed job.
 *
 * Query params:
 *   format=txt  (default) — plain-text response
 *   format=docx — Word document with Content-Disposition attachment header
 *
 * Auth: requireJobOwner (cookie -> JWT -> jobIndex -> sessionOwnership -> userId).
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { jobId: jobIdParam } = await context.params;

  const auth = await requireJobOwner(request, jobIdParam);
  if (!auth.ok) return auth.response;

  const exportPath = getJobExportPath(auth.sessionId, auth.jobId);

  let text: string;
  try {
    text = await fs.readFile(exportPath, "utf8");
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return jsonError(404, "NOT_FOUND", "Export not found for this job.");
    return jsonError(500, "INTERNAL", "Failed to read export.");
  }

  // ── Format negotiation ──────────────────────────────────────
  const url = new URL(request.url);
  const format = url.searchParams.get("format")?.toLowerCase() ?? "txt";

  if (format === "docx") {
    const buffer = await createDocxBufferFromText(text, {
      title: "Clinical Note",
    });
    const filename = `note-${auth.jobId}.docx`;

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  }

  // Default: plain text
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
