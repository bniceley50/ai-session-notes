---
name: session-wrapup
description: Create an end-of-session wrapup and update NEXT/DECISIONS/CONTEXT and JOURNAL/WRAPUPS as needed.
metadata:
  short-description: Create an end-of-session wrapup and update NEXT/DECISIONS/CONTEXT and JOURNAL/WRAPUPS as needed.
---

# session-wrapup

## When to use
Use at the end of a work session when you want a clean summary + the repo docs updated.

## Workflow
1) Read the relevant recent notes (latest JOURNAL entry and/or recent changes).
2) Produce a tight wrapup:
   - What changed
   - What was decided (if anything)
   - What is blocked / unknown
   - Next actions (ordered)
3) Update files as needed:
   - Append a wrapup file under `JOURNAL/WRAPUPS/`
   - Update `NEXT.md` to reflect the ordered next actions
   - Update `DECISIONS.md` only if a decision was made/reversed
   - Update `CONTEXT.md` only if ongoing context shifted
4) Run `tools\gate.cmd`

## Output format
- Wrapup (bullets)
- Files changed
- Verification command to run
