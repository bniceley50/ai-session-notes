---
name: decision-log
description: Log and maintain clear project decisions in DECISIONS.md with rationale and revisit triggers.
metadata:
  short-description: Log and maintain clear project decisions in DECISIONS.md with rationale and revisit triggers.
---

# decision-log

# # When to use
Use when decisions exist in chat/notes but aren’t recorded clearly.

# # Workflow
1) Scan for decisions in recent JOURNAL and commits.
2) Update `DECISIONS.md` with entries including:
   - Date
   - Decision statement
   - Rationale
   - Tradeoffs / risks
   - Revisit trigger
3) Do not rewrite old decisions unless incorrect; append a new entry for reversals.
4) Run `tools\gate.cmd`
