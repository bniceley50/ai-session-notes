# ai-session-notes — Agent Contract (AGENTS.md)

**Repo root:** `N:\asn\ai-session-notes`

**Full operating rules:** See `docs/AGENT_PLAYBOOK.md`.

## Hard rules (non-negotiable)

1) **Default is READ-ONLY.**
- Do not edit files, run formatters, or change git state unless the user includes:
  - `EDIT_OK: <comma-separated list of allowed files>`
- If `EDIT_OK` is missing: read-only actions only (view files, run checks that don’t modify state).

2) **One change → gate.**
- Make exactly one patch (the “unit of work”).
- Then run:
  - `.\tools\gate.cmd`
  - `git diff --stat`
  - `git status -sb`

3) **No question loops (question budget).**
- **Question budget = 0 unless blocked.**
- “Blocked” means you literally cannot proceed safely because required input is missing.
- If blocked: ask **one sentence**, state a **default**, proceed immediately using that default.

4) **Command discipline**
- Every command must be labeled:
  - `PASTE INTO: TERMINAL (PowerShell)`
  - `PASTE INTO: CODEX`
- If it’s not labeled, it doesn’t get run.

## Preflight facts (read-only)

At the start of every session, verify these 3 facts before doing anything else:

1. Contract + permissions: confirm `docs/AGENT_CONTRACT.md` and whether edits require explicit `EDIT_OK`.
2. Repo reality check: `git status -sb` and `git log -1 --oneline`.
3. Plan of record: read `NEXT.md` + `DECISIONS.md` so “done” is not guesswork.

## Weekly quality pass (once per week)

Once per week (not every day), do a short cleanup pass:

- remove dead code
- tighten types
- add 1–2 tests
- update `DECISIONS.md` if anything changed
