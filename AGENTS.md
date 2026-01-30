# ai-session-notes - Codex Working Agreements (AGENTS.md)

This repo is for **AI session notes**: maintaining context, decisions, next steps, and wrapups.
Codex should optimize for **clarity, correctness, and minimal churn**.

# # Definition of done
- The change is **small and focused** (no "while I'm here..." refactors).
- The right docs are updated:
  - **CONTEXT.md** when ongoing context changes
  - **DECISIONS.md** when a decision is made/reversed
  - **NEXT.md** when priorities/tasks change
  - **JOURNAL/** for dated notes; **JOURNAL/WRAPUPS/** for end-of-session summaries
- No broken Markdown (obvious formatting issues, accidental code fences, etc.).
- Run the repo gate: `tools\gate.cmd`

# # Operating rules
- **One change per turn.** Make the smallest patch, then run the gate.
- Always create a checkpoint before edits:
  - `git status -sb`
  - `git diff --stat`
- If something is unclear, propose 2-3 plausible interpretations and pick the safest.
- Stop immediately if ANY unrequested changes appear (new files/folders, unrelated diffs) and ask.
- Ask before creating new routes/pages/components.
- Host-based dev is allowed for this repo (Windows + external drive). Prefer containers when feasible,
  but never force Docker if it causes friction.

# # Repo conventions
- Prefer appending new dated content over rewriting history.
- Keep titles descriptive and stable.
- Don't delete "backup" files unless asked; if you must, move them to `JOURNAL/_trash/` and explain why.

# # Output expectations
When you propose a change, include:
- What files change
- Why
- The exact command(s) to run to verify (usually `tools\gate.cmd`)

# # Important rules
- Build modular first. No code files longer than 300 lines of code! Documentation, plans etc. can be as long as needed, but code files must be modular.
- Think ahead! Do not write code that you know will need to be changed later without planning for that change now. So keep entrypoints stable and isolate logic into smaller modules from the start!
- Do not limit yourself due to the LOC limit! If a task requires more code, split it into multiple files/modules/functions
- Do not add default fallbacks during development phase. Is something fails, let it fail, so we can fix it!
- Do not leavy empty try-catch blocks anywhere!
- Do not reinvent the wheel! Use open source, self-hosted libraries when needed. Ask the user, and help them qualify their selection.
- Design UI for the end-user, not for the schema!

# # Continuity Ledger (compaction-safe)

Maintain a single continuity file for this workspace: CONTINUITY.md.
CONTINUITY.md is the canonical briefing designed to survive compaction; do not rely on earlier chat/tool output unless it's reflected there.

# # # Operating rule
- At the start of each assistant turn: read CONTINUITY.md before acting.
- Update CONTINUITY.md only when there is a meaningful delta in: Goal/success criteria, Invariants/constraints, Decisions, State (Done/Now/Next), Open questions, Working set, or important tool outcomes.

# # # Keep it bounded (anti-bloat)
- Keep CONTINUITY.md short and high-signal:
  - Snapshot: <= 25 lines.
  - Done (recent): <= 7 bullets.
  - Working set: <= 12 paths.
  - Receipts: keep last 10-20 entries.
- If sections exceed caps, compress older items into milestone bullets with pointers (commit/PR/log path/doc path). Do not paste raw logs.

# # # Anti-drift rules
- Facts only, no transcripts.
- Every entry must include:
  - a date or ISO timestamp (e.g., 2026-01-13 or 2026-01-13T09:42Z)
  - a provenance tag: [USER], [CODE], [TOOL], [ASSUMPTION]
- If unknown, write UNCONFIRMED (never guess). If something changes, supersede it explicitly (don't silently rewrite history).

# # # Decisions and incidents
- Record durable choices in Decisions as ADR-lite entries (e.g., D001 ACTIVE: ...).
- For recurring weirdness, create a small, stable incident capsule (Symptoms / Evidence pointers / Mitigation / Status).

# # # Plan tool vs ledger
- Use update_plan for short-term execution scaffolding (3-7 steps).
- Use CONTINUITY.md for long-running continuity ("what/why/current state"), not micro task lists.
- Keep them consistent at the intent/progress level.

# # # In replies
- Start with a brief "Ledger Snapshot" (Goal + Now + Next + Open Questions).
- Print the full ledger only when it materially changed or the user requests it.
