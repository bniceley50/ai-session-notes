import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SessionJobProvider } from "@/components/session/SessionJobContext";
import { AudioInput } from "@/components/session/AudioInput";
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
    <div className="flex-1 flex flex-col h-full min-h-0 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-none">
        <div>
          <Link
            href="/sessions/new"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            + New Session
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
            Session Workspace
          </h1>
          <p className="mt-1 text-xs font-mono text-slate-500">ID: {decodedSessionId}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Session artifacts auto-delete in 24 hours.
          </p>
          <ThemeToggle />
        </div>
      </div>

      {/* WORKSPACE — Takes ~75-80% of height */}
      <SessionJobProvider sessionId={decodedSessionId}>
        <div className="flex-[3] grid grid-cols-1 lg:grid-cols-3 grid-rows-[1fr_auto] gap-4 min-h-0">
          {/* Row 1: Audio Input | Transcript | AI Analysis — Three equal-height panels */}
          <div className="min-h-0 lg:row-span-1">
            <AudioInput sessionId={decodedSessionId} />
          </div>

          <div className="min-h-0 lg:row-span-1">
            <TranscriptViewer sessionId={decodedSessionId} />
          </div>

          <div className="min-h-0 lg:row-span-1">
            <AIAnalysisViewer sessionId={decodedSessionId} />
          </div>

          {/* Row 2: Structured Notes — Full-width panel spanning all 3 columns */}
          <div className="lg:col-span-3 min-h-0">
            <NoteEditor sessionId={decodedSessionId} />
          </div>
        </div>
      </SessionJobProvider>

    </div>
  );
}

