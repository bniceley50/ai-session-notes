# Agent Playbook (ai-session-notes)

This repo runs **fast and deterministic**. No wandering. No question loops.

## Purpose

- Keep the build moving with minimal friction.
- Keep changes small, verified, and reversible.
- Make it easy for multiple agents/tools to work without chaos.

---

## Non-negotiables

### 1) Default mode is READ-ONLY
Do not edit files, run formatters, install deps, or change git state unless the user includes:

- `EDIT_OK: file1, file2, ...`

If `EDIT_OK` is missing, you may only:
- Read files
- Run checks that do not modify state (ex: `git status -sb`, `git log -1`, `\.tools\gate.cmd` **only if it does not write**)
- Propose exact next steps

### 2) One change → gate
Exactly one patch (the unit of work), then immediately:

1. `\.tools\gate.cmd`
2. `git diff --stat`
3. `git status -sb`

If gate fails:
- Stop. Fix only what’s required to get gate green.
- Gate again.
- Report the first error and its context (don’t paste walls of text).

### 3) No question loops (question budget)
**Question budget = 0 unless blocked.**

- “Blocked” = you cannot proceed safely because a required input is missing.
- If blocked:
  - Ask **one sentence**
  - State a **default**
  - Proceed immediately using that default

### 4) Always anchor commands to repo root
Every command block starts with:

`Set-Location -LiteralPath "N:\asn\ai-session-notes"`

### 5) Report “Questions (blocking)” every time
At the end of every response include:

`Questions (blocking): none`

Only list real blocking questions.

---

## Preflight facts (read-only)

Before doing any work, verify these 3 facts:

1. **Contract + permissions:** confirm `docs/AGENT_CONTRACT.md` and any edit restrictions / `EDIT_OK` requirements.
2. **Repo reality check:** run `git status -sb` and `git log -1 --oneline`.
3. **Plan of record:** read `NEXT.md` + `DECISIONS.md` so “done” is explicit.

---

## Working model (Brian ↔ Agent)

- **Brian = operator** (runs commands / approves edits)
- **Agent = navigator** (proposes one change, gives exact commands, then gates)

---

## Command discipline

Every command must be labeled:

- `PASTE INTO: TERMINAL (PowerShell)` — Brian runs
- `PASTE INTO: CODEX` — agent runs inside Codex session

If it’s not labeled, it doesn’t get run.

---

## Gate = definition of “done”

After each patch:

- `\.tools\gate.cmd`
- `git diff --stat`
- `git status -sb`

Report back:
- Gate result summary
- First error if any (with ~20 lines context)
- Current working tree state

---

## Defaults (use these instead of asking)

If not blocked, pick defaults and proceed:

- Status mapping: `upload→uploaded`, `transcribe→transcribed`, `draft→drafted`, `export→exported`
- Idempotency: if already at or past target status, return current job (no new history entry)
- Sorting history: keep append-only order unless a bug forces sorting
- Progress: use monotonic rules + floor per stage

---

## Weekly quality pass (once per week)

Once per week (not every day):

- remove dead code
- tighten types
- add 1–2 tests
- update `DECISIONS.md` if anything changed

Keep it small and boring. This prevents rot.

---

## “Stop digging” rule

If a change starts branching into multiple problems:
- Stop.
- Finish the smallest shippable fix.
- Gate.
- Then do the next patch.

Questions (blocking): none
