# ai-session-notes — Codex Working Agreements (AGENTS.md)

This repo is for **AI session notes**: maintaining context, decisions, next steps, and wrapups.
Codex should optimize for **clarity, correctness, and minimal churn**.

## Definition of done
- The change is **small and focused** (no “while I’m here…” refactors).
- The right docs are updated:
  - **CONTEXT.md** when ongoing context changes
  - **DECISIONS.md** when a decision is made/reversed
  - **NEXT.md** when priorities/tasks change
  - **JOURNAL/** for dated notes; **JOURNAL/WRAPUPS/** for end-of-session summaries
- No broken Markdown (obvious formatting issues, accidental code fences, etc.).
- Run the repo gate: `tools\gate.cmd`

## Operating rules
- **One change per turn.** Make the smallest patch, then run the gate.
- Always create a checkpoint before edits:
  - `git status -sb`
  - `git diff --stat`
- If something is unclear, propose 2–3 plausible interpretations and pick the safest.

## Repo conventions
- Prefer appending new dated content over rewriting history.
- Keep titles descriptive and stable.
- Don’t delete “backup” files unless asked; if you must, move them to `JOURNAL/_trash/` and explain why.

## Output expectations
When you propose a change, include:
- What files change
- Why
- The exact command(s) to run to verify (usually `tools\gate.cmd`)
