# CONTINUITY.md

# # Snapshot (<= 25 lines)
- 2026-03-02 [CODE] Durability Phase 1 shipped: atomic writes (67a6dce), state.json (1b7f9fb), idempotent stage skip (e605314).
- 2026-03-02 [CODE] jspdf upgraded 4.1.0 -> 4.2.0 in both repos (fc7f17d, b61cf23). pnpm audit --prod clean.
- 2026-03-01 [CODE] Security hardening round shipped: auth CSRF (14988e1), download headers (64eb7ef), runner.lock cleanup (08b7313).
- 2026-03-01 [CODE] NEXT.md audited: items #1–#6 all confirmed shipped; NEXT.md updated to reflect reality.
- 2026-01-25 [USER] Goal: Governance docs to prevent drift; docs-only changes (AGENTS.md + CONTINUITY.md).
- 2026-01-25 [USER] Invariants: modular-first; no code file > 300 LOC; fail fast (no silent fallbacks); no empty try/catch; prefer OSS/self-hosted libs; UI for end-user not schema.
- 2026-01-25 [TOOL] Environment: Windows PowerShell; repo on external drive N:\asn\ai-session-notes; host-based dev allowed.

# # Decisions (ADR-lite)
- D001 ACTIVE 2026-01-25 [USER] CONTINUITY.md is canonical; read at start of each assistant turn; bounded sections; provenance tags required.

# # Done (recent) (<= 7 bullets)
- 2026-03-02 [CODE] Durability Phase 1: atomic writes + state.json + idempotent stage skip (67a6dce, 1b7f9fb, e605314).
- 2026-03-02 [CODE] fix: jspdf 4.1.0 -> 4.2.0 — patches 3 HIGH vulns (fc7f17d ai-session-notes, b61cf23 legal-notes-v1).
- 2026-03-01 [CODE] Docs alignment: NEXT.md, CONTINUITY.md, DECISIONS.md updated; docs/DURABILITY.md added.
- 2026-03-01 [CODE] sec: auth routes hardened with POST+CSRF + middleware allowlist tightened (14988e1).
- 2026-03-01 [CODE] sec: download/export headers hardened across all artifact routes (64eb7ef).
- 2026-03-01 [CODE] fix: runner.lock always removed in finally block of pipeline (08b7313).
- 2026-01-27 [CODE] Added SKILLS/onboard.md ($onboard) for repo onboarding.

# # Now
- 2026-03-02 [CODE] Durability Phase 1 complete. Branch ready for PR + squash merge.
- 2026-03-02 [CODE] Latest commits: e605314 (idempotent skip), 1b7f9fb (state.json), 67a6dce (atomic writes).

# # Next
- 2026-03-02 [CODE] Merge PR for claude/placeholder-task-JwyWg. Manual smoke test (PDF export, double-runner, outputs unchanged).
- 2026-03-02 [CODE] Durability Phase 2: retry semantics + error classification. See docs/DURABILITY.md.

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
- 2026-03-02 [CODE] Commit e605314: feat: idempotent stage skip when outputs exist (durability phase 1, patch 3).
- 2026-03-02 [CODE] Commit 1b7f9fb: feat: add state.json at pipeline stage boundaries (durability phase 1, patch 2).
- 2026-03-02 [CODE] Commit 67a6dce: feat: atomic file writes for pipeline outputs (durability phase 1, patch 1).
- 2026-03-02 [CODE] Commit fc7f17d: fix: upgrade jspdf 4.1.0 -> 4.2.0.
- 2026-03-01 [CODE] Commit 833e243: docs: align NEXT/continuity with shipped hardening + add durability plan.
- 2026-03-01 [CODE] Commit 08b7313: fix: clean up runner.lock in pipeline finally block.
- 2026-03-01 [CODE] Commit 64eb7ef: sec: harden download/export response headers across all artifact routes.
- 2026-03-01 [CODE] Commit 14988e1: sec: harden auth routes with POST+CSRF and tighten middleware allowlist.
- 2026-01-27 [CODE] Commit b9d8b01: docs: add $onboard skill for repo onboarding.
- 2026-01-27 [CODE] Commit bf946c1: docs: remove UTF-8 BOM from NEXT.md.
- 2026-01-25 [TOOL] git --no-pager diff -- AGENTS.md confirmed required sections present; ASCII scan clean.
- 2026-01-25 [CODE] Commit 4a649c6: docs: require repo anchor first line in PowerShell blocks.
