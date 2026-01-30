# $onboard — repo onboarding (read-only)

Purpose
- Onboard fast, without drift: confirm repo state, read canonical docs (bounded), and output a high-signal snapshot + ONE next action.

Hard rules
- Facts only (no transcripts, no raw logs).
- Stop if working tree is dirty (unless the task is explicitly “review current diff”).
- Every PowerShell command block MUST start with:
  Set-Location -LiteralPath 'N:\asn\ai-session-notes'

What to run (bounded reads)
1) Preflight (must be clean)
- git status -sb
- git diff --name-only
If ANY output under diff: STOP and ask what to do.

2) Read canonical docs (bounded)
- Get-Content .\AGENTS.md -TotalCount 120
- Get-Content .\CONTINUITY.md -TotalCount 240
- Get-Content .\DECISIONS.md -TotalCount 240
- Get-Content .\NEXT.md -TotalCount 160
- if (Test-Path .\CONTEXT.md) { Get-Content .\CONTEXT.md -TotalCount 240 }
- if (Test-Path .\docs\codex-workflow.md) { Get-Content .\docs\codex-workflow.md -TotalCount 240 }

3) Optional: map the doc surface area (index only; do not dump file contents)
- rg --files -g "*.md" -g "*.mdx" -g "!**/node_modules/**" -g "!**/.git/**" -g "!**/.next/**" -g "!**/dist/**" -g "!**/build/**"

Required output format (in chat)
Ledger Snapshot
- Goal:
- Now:
- Next:
- Open Questions: (use UNCONFIRMED if unknown; never guess)

Repo Rules (top 5-10)
- (bullet list; only what is actually in AGENTS/CONTINUITY/codex-workflow)

Current Work Item
- Quote NEXT.md in one sentence (no extra tasks invented)

Proposed single next patch (ONE change only)
- Files to touch:
- What changes:
- Verification:
  - pnpm dev (if applicable)
  - .\tools\gate.cmd

Stop conditions
- If any unexpected diffs appear, STOP and ask.
- If a command fails, paste only the first error + ~20 lines of context.
