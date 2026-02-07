import Link from "next/link";
import JobPanel from "@/components/JobPanel";
import { TranscriptViewer } from "@/components/session/TranscriptViewer";
import { AIAnalysisViewer } from "@/components/session/AIAnalysisViewer";
import { NoteEditor } from "@/components/session/NoteEditor";

type SessionDetailPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = await params;
  const decodedSessionId = decodeURIComponent(sessionId);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-none">
        <div>
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            ← Back to sessions
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
            Session Workspace
          </h1>
          <p className="mt-1 text-xs font-mono text-slate-500">ID: {decodedSessionId}</p>
        </div>
      </div>

      {/* 3-pane workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 pb-2">
        {/* Left: Job panel */}
        <div className="lg:col-span-4 min-h-0">
          <JobPanel sessionId={decodedSessionId} />
        </div>

        {/* Right: Transcript + AI analysis + Note editor */}
        <div className="lg:col-span-8 grid grid-cols-1 lg:grid-cols-2 grid-rows-[45%_1fr] gap-4 lg:gap-6 min-h-0">
          <div className="min-h-0">
            <TranscriptViewer sessionId={decodedSessionId} />
          </div>

          <div className="min-h-0">
            <AIAnalysisViewer sessionId={decodedSessionId} />
          </div>

          <div className="lg:col-span-2 min-h-0">
            <NoteEditor sessionId={decodedSessionId} />
          </div>
        </div>
      </div>
    </div>
  );
}
