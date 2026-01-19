---
name: repo-hygiene
description: Propose safe repo cleanup (naming, placement, backups) without deleting anything unless explicitly approved.
metadata:
  short-description: Propose safe repo cleanup (naming, placement, backups) without deleting anything unless explicitly approved.
---

# repo-hygiene

## When to use
Use when the repo is accumulating clutter or structure is drifting.

## Workflow
1) Identify:
   - Duplicate/backup files (e.g., *.bak-*)
   - Misplaced notes
   - Naming inconsistencies
2) Propose a cleanup plan.
3) Do not delete without explicit permission:
   - Prefer moving into `JOURNAL/_trash/` with explanation.
4) Run `tools\gate.cmd` after any move/rename.
