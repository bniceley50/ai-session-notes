import Link from "next/link";
import JobPanel from "@/components/JobPanel";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { getSessionById } from "@/lib/sessions/mock";
import SessionDetail from "./SessionDetail";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parseYmdToLocalDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type SessionDetailPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = await params;
  const session =
    getSessionById(sessionId) ?? {
      id: sessionId,
      patientName: "Unknown",
      date: new Date().toISOString().slice(0, 10),
      summary: "Session details not yet available.",
      transcript: "",
      note: "",
    };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[18rem_1fr]">
      <div className="hidden md:block">
        <WorkspaceSidebar activeSessionId={sessionId} />
      </div>
      <div className="p-4">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Link
                href="/"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-700"
              >
                Back to sessions
              </Link>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {session.patientName}
              </h1>
              <p className="text-sm text-slate-600">
                {dateFormatter.format(parseYmdToLocalDate(session.date))}{" \u2022 "}{session.summary}
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Session detail
            </div>
          </div>
        </header>

        <SessionDetail session={session} />
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Job pipeline
          </div>
          <JobPanel sessionId={sessionId} />
        </section>
        </main>
      </div>
    </div>
  );
}



