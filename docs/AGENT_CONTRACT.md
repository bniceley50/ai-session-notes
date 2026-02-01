# AI Agent Contract — ai-session-notes

This file is the single source of truth for how any AI agent (Codex, ChatGPT, Claude, etc.) must behave when working on this repo.

If an agent conflicts with this contract, this contract wins.

---

## 0) Two modes: READ-ONLY by default

### Default mode: READ-ONLY
- You are NOT allowed to change files, run formatting, write commits, or push.
- You may only inspect, summarize, propose, and produce commands for the human to run.

### Write mode: only when explicitly authorized
You may edit files only when the human includes a line like this:

**EDIT_OK:** `<what you are allowed to change>`

Examples:
- `EDIT_OK: src/lib/jobs/store.ts only`
- `EDIT_OK: add docs/AGENT_CONTRACT.md (new file only)`
- `EDIT_OK: any files needed for this task`

If **EDIT_OK** is not present, you must stay READ-ONLY. No exceptions.

---

## 1) Momentum rules: no question loops

### Question Budget: 0
Do **not** ask questions unless you are genuinely blocked.

### “Blocked” definition
Blocked means you **cannot safely proceed** without missing required input that would cause:
- incorrect behavior,
- security risk,
- destructive changes,
- or wasted work that must be redone.

If not blocked, pick defaults and proceed.

### If you MUST ask a question
You are allowed **one** question total, and you must:
1) Ask the question in one sentence
2) Provide a default assumption
3) Continue immediately using the default (no waiting)

No “Do you want me to…?” permission-questions for routine steps.

---

## 2) Operating cadence: one change then gate

When in WRITE mode:
1) Make exactly ONE logical change (one patch set)
2) Run gate: `.\tools\gate.cmd`
3) Report results in this exact format:
   - `git status -sb`
   - `git diff --stat`
   - gate summary (pass/fail + first error if fail)

Do not stack multiple unrelated changes in one step.

---

## 3) Command labeling (prevents confusion)

Every command must be labeled as one of these:

### PASTE INTO: TERMINAL (PowerShell)
Used for commands the human runs.

### PASTE INTO: CODEX
Used only when the human is explicitly using Codex and expects Codex to execute.

If a command is not labeled, it should not be run.

---

## 4) Default technical policies (use unless told otherwise)

### Auth & permissions
- APIs that read/modify job data: require session cookie → 401 if missing.
- Scope to `practiceId` → 404 if mismatch or missing.

### Jobs/events timeline
- Status history appends ONLY on status change.
- Progress never decreases.
- “failed” is terminal and must never occur automatically in tick simulation.

### Testing philosophy
- Prefer `node:test` (no new deps) unless blocked.
- Avoid adding frameworks unless asked.

### Formatting policy
- No whitespace-only changes.
- No “drive-by” refactors.
- No reformatting unrelated files.
- Keep diffs tight and explain why each change exists.

---

## 5) Output contract (what you must report)

When you finish a step, report:
- What changed (1–3 bullets)
- Gate result (pass/fail)
- If fail: paste the first error + ~20 lines around it
- Next step you will do (one sentence)

Do not paste giant file dumps unless requested.

---

## 6) Repo reality check (do not hallucinate)
If you didn’t open a file or run a command, don’t claim you did.
If you’re unsure, say exactly what you’re missing and propose the smallest check to confirm.

---

## 7) Copy/paste: Codex new-session prompt (STRICT)

Use this block at the top of every new Codex session:

```text
You are working on repo: N:\asn\ai-session-notes

Follow docs/AGENT_CONTRACT.md. If anything conflicts, that contract wins.

MODE: READ-ONLY unless the user includes a line starting with: EDIT_OK:

QUESTION BUDGET: 0. Do not ask questions unless blocked.
If blocked: ask one question, state a default, and proceed using the default.

When edits are allowed: ONE change then run .\tools\gate.cmd, then report:
- git status -sb
- git diff --stat
- gate summary (pass/fail + first error if fail)

Do not do drive-by formatting or refactors. Keep diffs minimal and intentional.
```
