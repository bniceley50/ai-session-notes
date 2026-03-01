# CONTINUITY.md

# # Snapshot (<= 25 lines)
- 2026-03-01 [CODE] Security hardening round shipped: auth CSRF (14988e1), download headers (64eb7ef), runner.lock cleanup (08b7313).
- 2026-03-01 [CODE] NEXT.md audited: items #1–#5 all confirmed shipped; NEXT.md updated to reflect reality.
- 2026-03-01 [CODE] Next workstream: durability architecture (docs/DURABILITY.md). No runtime changes yet.
- 2026-01-25 [USER] Goal: Governance docs to prevent drift; docs-only changes (AGENTS.md + CONTINUITY.md).
- 2026-01-25 [USER] Invariants: modular-first; no code file > 300 LOC; fail fast (no silent fallbacks); no empty try/catch; prefer OSS/self-hosted libs; UI for end-user not schema.
- 2026-01-25 [TOOL] Environment: Windows PowerShell; repo on external drive N:\asn\ai-session-notes; host-based dev allowed.

# # Decisions (ADR-lite)
- D001 ACTIVE 2026-01-25 [USER] CONTINUITY.md is canonical; read at start of each assistant turn; bounded sections; provenance tags required.

# # Done (recent) (<= 7 bullets)
- 2026-03-01 [CODE] Docs alignment: NEXT.md, CONTINUITY.md, DECISIONS.md updated; docs/DURABILITY.md added.
- 2026-03-01 [CODE] sec: auth routes hardened with POST+CSRF + middleware allowlist tightened (14988e1).
- 2026-03-01 [CODE] sec: download/export headers hardened across all artifact routes (64eb7ef).
- 2026-03-01 [CODE] fix: runner.lock always removed in finally block of pipeline (08b7313).
- 2026-01-27 [CODE] Added SKILLS/onboard.md ($onboard) for repo onboarding.
- 2026-01-27 [CODE] Removed UTF-8 BOM from NEXT.md.
- 2026-01-25 [CODE] Marked src/lib/supabase/client.ts as client-only (added use-client directive); removed BOM.

# # Now
- 2026-03-01 [CODE] All NEXT.md items (#1–#6) confirmed shipped. Docs alignment patch in progress.
- 2026-03-01 [CODE] Latest commits: 08b7313 (runner.lock), 64eb7ef (headers), 14988e1 (auth CSRF).

# # Next
- 2026-03-01 [CODE] Durability architecture: Phase 1 (crash-safe artifacts + lock hygiene). See docs/DURABILITY.md.

# # Open questions
- (none currently)

# # Working set (<= 12 paths)
- 2026-01-25 [CODE] AGENTS.md
- 2026-01-25 [CODE] CONTINUITY.md
- 2026-01-25 [CODE] CONTEXT.md
- 2026-01-25 [CODE] DECISIONS.md
- 2026-01-25 [CODE] NEXT.md
- 2026-01-25 [CODE] JOURNAL/

# # Receipts (last 10-20)
- 2026-03-01 [CODE] Commit 08b7313: fix: clean up runner.lock in pipeline finally block.
- 2026-03-01 [CODE] Commit 64eb7ef: sec: harden download/export response headers across all artifact routes.
- 2026-03-01 [CODE] Commit 14988e1: sec: harden auth routes with POST+CSRF and tighten middleware allowlist.
- 2026-01-27 [CODE] Commit b9d8b01: docs: add $onboard skill for repo onboarding.
- 2026-01-27 [CODE] Commit bf946c1: docs: remove UTF-8 BOM from NEXT.md.
- 2026-01-25 [TOOL] git --no-pager diff -- AGENTS.md confirmed required sections present; ASCII scan clean.
- 2026-01-25 [CODE] Commit 4a649c6: docs: require repo anchor first line in PowerShell blocks.
