# CONTINUITY.md

## Snapshot (<= 25 lines)
- 2026-01-25 [USER] Goal: Governance docs to prevent drift; docs-only changes (AGENTS.md + CONTINUITY.md).
- 2026-01-25 [USER] Invariants: modular-first; no code file > 300 LOC; fail fast (no silent fallbacks); no empty try/catch; prefer OSS/self-hosted libs; UI for end-user not schema.
- 2026-01-25 [TOOL] Environment: Windows PowerShell; repo on external drive N:\asn\ai-session-notes; host-based dev allowed.

## Decisions (ADR-lite)
- D001 ACTIVE 2026-01-25 [USER] CONTINUITY.md is canonical; read at start of each assistant turn; bounded sections; provenance tags required.

## Done (recent) (<= 7 bullets)
- 2026-01-25 [CODE] Marked src/lib/supabase/client.ts as client-only (added use-client directive); removed BOM.
- 2026-01-25 [CODE] Updated AGENTS.md: ASCII punctuation, drift-guard bullets, Important rules, Continuity Ledger policy.
- 2026-01-25 [CODE] Added mandatory repo anchor line section to docs/codex-workflow.md.

## Now
- 2026-01-25 [CODE] Next: add src/lib/supabase/admin.ts (server-only service-role client) and refactor org bootstrap route to use it.
- 2026-01-25 [CODE] Working tree clean; latest commits: 4a649c6 (workflow repo-anchor requirement), 21494a0 (continuity ledger update).
- 2026-01-25 [CODE] CONTINUITY.md created (this file).

## Next
- 2026-01-25 [TOOL] Verify only AGENTS.md and CONTINUITY.md changed.
- 2026-01-25 [TOOL] Run repo gate (expected: tools\gate.cmd) and capture pass/fail.

## Open questions
- 2026-01-25 [ASSUMPTION] UNCONFIRMED: Is tools\gate.cmd the correct gate command for this repo?

## Working set (<= 12 paths)
- 2026-01-25 [CODE] AGENTS.md
- 2026-01-25 [CODE] CONTINUITY.md
- 2026-01-25 [CODE] CONTEXT.md
- 2026-01-25 [CODE] DECISIONS.md
- 2026-01-25 [CODE] NEXT.md
- 2026-01-25 [CODE] JOURNAL/

## Receipts (last 10-20)

- 2026-01-25 [TOOL] git --no-pager diff -- AGENTS.md confirmed required sections present; ASCII scan clean.
- 2026-01-25 [CODE] Commit 4a649c6: docs: require repo anchor first line in PowerShell blocks.
