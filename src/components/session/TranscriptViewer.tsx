import type { ReactNode } from "react";

type Props = { sessionId: string };

type Line = { speaker: string; text: string };

const mockTranscript: Line[] = [
  { speaker: "Patient", text: "I’ve been feeling more anxious lately, especially at night." },
  { speaker: "Clinician", text: "When did you first notice the increase?" },
  { speaker: "Patient", text: "About two weeks ago, around the time work got busier." },
  { speaker: "Clinician", text: "Let’s list the triggers so we can prioritize coping strategies." },
];

function TranscriptLine({ speaker, text }: Line) {
  return (
    <div className="text-sm font-mono text-slate-800 dark:text-slate-100">
      <span className="font-semibold text-slate-500 dark:text-slate-400 mr-2">{speaker}:</span>
      <span className="text-slate-800 dark:text-slate-100">{text}</span>
    </div>
  );
}

export function TranscriptViewer({ sessionId }: Props) {
  return (
    <section className="card-base h-full flex flex-col gap-3 min-h-[260px]">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Transcript</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Session ID: {sessionId}</p>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {mockTranscript.map((line, idx) => (
          <TranscriptLine key={idx} {...line} />
        ))}
      </div>
    </section>
  );
}
