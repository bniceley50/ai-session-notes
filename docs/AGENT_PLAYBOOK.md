# Agent Playbook (ai-session-notes)

This repo runs **fast and deterministic**. No wandering. No question loops.

## Purpose

- Keep the build moving with minimal friction.
- Keep changes small, verified, and reversible.
- Make it easy for multiple agents/tools to work without chaos.

---

## Non-negotiables

### Default mode is READ-ONLY
Do not edit files, run formatters, install deps, or change git state unless the user includes:

- `EDIT_OK: file1, file2, ...`

If `EDIT_OK` is missing, you may only:
- Read files
- Run checks that do not modify state (ex: `git status -sb`, `git log -1`)
- Propose exact next steps

### One change → gate
Exactly one patch (the “unit of work”), then immediately run:

- `\.tools\gate.cmd`
- `git diff --stat`
- `git status -sb`

Report back:
- Gate result summary
- First error if any (with ~20 lines context)
- Current working tree state

### No question loops (question budget)
**Question budget = 0 unless blocked.**

- Blocked = you cannot proceed safely because required input is missing.
- If blocked:
  - Ask **one** question (one sentence).
  - State a default.
  - Proceed using that default.

### Every command must be labeled
- `PASTE INTO: TERMINAL (PowerShell)` — Brian runs
- `PASTE INTO: CODEX` — agent runs inside Codex session

If it is not labeled, it does not get run.

### “Stop digging” rule
If a change starts branching into multiple problems:
- Stop.
- Finish the smallest shippable fix.
- Gate.
- Then do the next patch.

### Defaults (use these instead of asking)
If not blocked, pick defaults and proceed:

- Status mapping: `upload→uploaded`, `transcribe→transcribed`, `draft→drafted`, `export→exported`
- Idempotency: if already at or past target status, return current job (**no new history entry**)
- Status history: keep append-only order unless a bug forces sorting
- Progress: monotonic rules + floor per stage

### Weekly quality pass (once per week)
Once per week (not every day):
- remove dead code
- tighten types
- add 1–2 tests
- update `DECISIONS.md` if anything changed

Keep it small and boring. This prevents rot.

---

## Milestones

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
- `upload` creates/stores an artifact (even if it’s just a copied file)
- `transcribe` creates `transcript.txt` (stub text is OK for now)
- `draft` creates `draft.md` or `draft.txt` (stub SOAP is OK for now)
- `export` creates:
  - `ehr.txt` (exportable text)
  - optional `note.pdf` later (not required for Milestone A)

**Deletion**
- “Delete now” deletes the job record AND deletes files in that job folder.
- TTL purge deletes expired job folders too (local filesystem purge is OK for now).

---

## Dev UX rule
Keep auth invisible for local dev.

But provide a tiny indicator + reset:
- Show `Signed in (dev)` when authed
- Provide `Logout` to clear state quickly during testing

---

## Session template
At the end of every response:

`Questions (blocking): none`
---
End of file.