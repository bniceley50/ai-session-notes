import Link from "next/link";
import JobPanel from "@/components/JobPanel";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { sessions } from "@/lib/sessions/mock";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parseYmdToLocalDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 grid grid-cols-1 md:grid-cols-[18rem_1fr]">
      <div className="hidden md:block">
        <WorkspaceSidebar />
      </div>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                AI Session Notes
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Sessions
              </h1>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              MVP
            </div>
          </div>
          <p className="max-w-2xl text-base text-slate-600">
            Review recent sessions, open a transcript, and refine the draft
            note before copying or exporting.
          </p>
        </header>

        <div className="grid gap-4">
          <JobPanel />
        </div>

        <section className="grid gap-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {dateFormatter.format(parseYmdToLocalDate(session.date))}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900 group-hover:text-slate-950">
                    {session.patientName}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Transcript Ready
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600">{session.summary}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
