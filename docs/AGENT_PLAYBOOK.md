# Agent Playbook (ai-session-notes)

This repo runs fast and deterministic. No wandering. No question loops.

## Purpose

- Keep the build moving with minimal friction.
- Keep changes small, verified, and reversible.
- Keep the repo “portfolio-grade”: clear docs, clear milestones, clear demo steps.
- Support multi-agent work (Codex builds; others review; one coordinator merges).

---

## Non-negotiables

### 1) Default mode is READ-ONLY
Do not edit files, run formatters, install deps, or change git state unless the user includes:

- `EDIT_OK: file1, file2, ...`

If `EDIT_OK` is missing, you may only:
- Read files
- Run checks that don’t modify state (ex: `git status -sb`, `git log -1 --oneline`)
- Propose exact next steps

### 2) One change → gate
Exactly one patch (the unit of work), then immediately run:

- `.\tools\gate.cmd`
- `git diff --stat`
- `git status -sb`

Report back:
- Gate result summary
- First error if any (with ~20 lines context)
- Current working tree state (clean/dirty + which files)

If gate fails:
- Stop.
- Fix only what is required to get gate green.
- Gate again.
- No refactors while failing.

### 3) No question loops (question budget)
**Question budget = 0 unless blocked.**

- Blocked = you cannot proceed safely because required input is missing.
- If blocked:
  - Ask ONE question (one sentence).
  - State the default you will use if unanswered.
  - Proceed using that default.

### 4) Every command must be labeled
- `PASTE INTO: TERMINAL (PowerShell)` — Brian runs
- `PASTE INTO: CODEX` — agent runs inside Codex session

If it is not labeled, it does not get run.

### 5) Stop digging rule
If a change starts branching into multiple problems:
- Stop.
- Finish the smallest shippable fix.
- Gate.
- Then do the next patch.

### 6) Defaults (use these instead of asking)
If not blocked, pick defaults and proceed:

- Status mapping: `upload→uploaded`, `transcribe→transcribed`, `draft→drafted`, `export→exported`
- Idempotency: if already at or past target status, return current job (**no new history entry**)
- Status history: append-only order unless a bug forces sorting
- Progress: monotonic rules + stage floors

### 7) Weekly quality pass (once per week)
Once per week (not every day):
- remove dead code
- tighten types
- add 1–2 tests
- update `DECISIONS.md` if anything changed

Keep it small and boring. Prevent rot.

---

## “Portfolio repo” expectations (lightweight)

This is not a research repo. Don’t invent ML folders. Keep it clean and obvious.

Minimum docs we want (add over time, small patches):
- `docs/DEMO.md` — exact demo steps (no AWS required for Milestone A demo)
- `docs/RUNBOOK_DEV.md` — dev setup + common fixes
- `docs/ARCHITECTURE.md` — 1–2 pages: data flow + components + milestones
- Existing: `DECISIONS.md`, `SECURITY.md`, `AGENTS.md`, this playbook

---

## Milestones

### Milestone 0 — Demo-first professionalism (docs + runbook)
Goal: anyone can open the repo and understand what it is, how to run it, and what’s real vs stubbed.

Rules:
- Any stubbed behavior must be labeled **DEMO/STUB** in code or docs.
- Add/maintain `docs/DEMO.md` with the exact “what to click” flow.

### Milestone A — Local demo pipeline (no AWS yet)
This is the “make it feel real” milestone. No cloud. No big design project.

**Artifacts location**
- All job artifacts live under repo root: `./.artifacts/`
- Canonical path:
  - `./.artifacts/<practiceId>/<sessionId>/<jobId>/`

**Hard rule: job ↔ session**
- A job MUST be tied to a session immediately.
- Jobs are created from the **Session Detail page**, not from the home page “in a vacuum.”
- Job record includes `sessionId` from day one.

**Stages produce real files**
- `upload` stores an artifact (copied file is fine)
- `transcribe` creates `transcript.txt` (stub text OK)
- `draft` creates `draft.md` or `draft.txt` (stub SOAP OK)
- `export` creates:
  - `ehr.txt`
  - `note.pdf` is optional later (not required in Milestone A)

**Deletion**
- “Delete now” deletes the job record AND deletes files in that job folder.
- TTL purge deletes expired job folders too (local filesystem purge OK).

### Milestone B — AWS becomes the real backend
AWS remains the “real” path. Milestone A is a demo scaffold, not the destination.

When switching:
- artifacts move to S3 (or equivalent) with TTL enforcement
- transcribe = AWS Transcribe Medical
- draft = Bedrock SOAP
- export = EHR text (+ PDF if required)

Keep interfaces stable so A → B is mostly swapping implementations.

---

## Dev UX rule
Keep auth invisible for local dev.

But provide a tiny indicator + reset:
- Show `Signed in (dev)` when authed
- Provide `Logout` to clear state quickly during testing

---

## Future: one-command launcher (Windows double-click)
Primary UX later: double-click on Windows.

Design intent (future only, not a milestone A requirement):
- `start.cmd` (or similar) does:
  - env checks
  - install deps if missing
  - starts `pnpm dev`
  - optionally opens browser
- Keep it boring. No magic. Always print what it’s doing.

---

## Session footer (required)
At the end of every response:

`Questions (blocking): none`
