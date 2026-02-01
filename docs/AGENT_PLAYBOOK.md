# Agent Playbook (ai-session-notes)

This repo runs **fast and deterministic**. No wandering. No question loops.

## Non-negotiables

- **Default mode is READ-ONLY.** Do not edit files, run formatters, or change git state unless the user includes an explicit `EDIT_OK:` line listing allowed files.
- **One change → gate.** Exactly one patch (can touch multiple files only if that *single patch* is the unit of work), then run `\.tools\gate.cmd`, then report results.
- **No question loops.** Do **not** ask for confirmations. Only ask questions if you are genuinely blocked and cannot proceed safely.
  - If something is missing, **choose sane defaults** and proceed.
- **Always anchor commands to repo root first line:**
  - `Set-Location -LiteralPath "N:\asn\ai-session-notes"`

## Working model (Brian ↔ Agent)

- **Brian = operator** (runs commands / approves writes)
- **Agent = navigator** (proposes exactly one change, provides exact commands, then gates)

## “Questions” rule (to stop the loop)

At the end of every response include:

- `Questions (blocking): none`

Only include real questions if you literally cannot proceed without an answer.

## Command discipline

Every command must be labeled:

- `PASTE INTO: TERMINAL (PowerShell)`
- `PASTE INTO: CODEX`

If it’s not labeled, it doesn’t get run.

## Gate (definition of “done” for a change)

After each change:

1. `\.tools\gate.cmd`
2. `git diff --stat`
3. `git status -sb`

Report:
- the first error (if any) + ~20 lines of context
- otherwise: `[OK] quickcheck passed` + diffstat summary

---

# CODEx prompts (copy/paste)

## A) CODEx – Repo Audit (STRICT READ-ONLY)

You are Codex working in this repo:

Repo root (Windows): `N:\asn\ai-session-notes`

**MODE: READ-ONLY.**
- Do NOT edit files.
- Do NOT run commands that modify repo state (no git add/commit, no formatters that write, no installs that write lockfiles).
- OK: reading files, searching, `git status -sb`, `git diff`, `git log -1`, `rg`, `ls`, `cat`, `pnpm -s` commands that do not write.

**Your job:**
1. Read: `NEXT.md`, `DECISIONS.md`, `AGENTS.md`, `docs/codex-workflow.md`, and scan these folders:
   - `src/app/api`
   - `src/lib/jobs`
   - `src/components`
2. Produce:
   - A completion table (DONE / PARTIAL / TODO) with file/route evidence
   - A weighted % complete estimate (explain weights)
   - “Next 3 tasks” (smallest shippable steps)
3. Keep it tight. No essays.
4. End with: `Questions (blocking): none` unless truly blocked.

## B) CODEx – Build Mode (EDITS REQUIRE EDIT_OK)

You are Codex working in: `N:\asn\ai-session-notes`

Default is READ-ONLY until the user provides:

`EDIT_OK: <comma-separated list of files you may modify>`

Rules:
- No questions unless blocked. Pick defaults and proceed.
- One change then gate:
  - apply exactly one patch
  - run `\.tools\gate.cmd`
  - show `git diff --stat` and `git status -sb`
- If a command would write files or change git state, present the exact command and wait for approval.
- End with: `Questions (blocking): none`

---

# Defaults we use when not specified

- Job stages: `queued → uploaded → transcribed → drafted → exported → complete` (failed is terminal, never auto-failed by tick)
- Endpoints: stub endpoints are **idempotent** (calling an earlier stage does nothing)
- Auth: endpoints require session cookie auth like other job routes

---

# Troubleshooting patterns

- If dev server isn’t reachable: start it in a separate terminal:
  - `pnpm dev`
- Smoke test scripts should run only when server is Ready on `http://localhost:3000`
- If typecheck fails after adding tests: exclude tests from main `tsconfig.json` or add a test-only tsconfig.
