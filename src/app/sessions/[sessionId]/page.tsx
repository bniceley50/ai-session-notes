import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionWithDetails } from "@/lib/sessions/data";
import SessionDetail from "./SessionDetail";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type SessionDetailPageProps = {
  params: { sessionId: string };
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  // TODO: Replace DEV_ORG_ID with proper user authentication/session management
  // This is a temporary MVP approach for single-org development
  const orgId = process.env.DEV_ORG_ID || "";
  
  if (!orgId) {
    notFound();
  }

  const session = await getSessionWithDetails(params.sessionId, orgId);

  if (!session) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
                {session.label}
              </h1>
              <p className="text-sm text-slate-600">
                {dateFormatter.format(new Date(session.created_at))} • Status: {session.status}
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Session detail
            </div>
          </div>
        </header>

        <SessionDetail session={session} />
      </main>
    </div>
  );
}
