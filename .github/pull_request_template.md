## Summary

<!-- 2-4 bullets: what changed and why -->

-

## Scope

**In scope:**
-

**Out of scope:**
-

## Validation checklist

- [ ] `pnpm tsc --noEmit` — clean
- [ ] `pnpm exec eslint src/ tests/` — 0 errors
- [ ] `pnpm exec playwright test` — passing *(required if UI or test selectors changed)*
- [ ] If `data-testid` changed → updated `tests/e2e/selectors.ts`
- [ ] If CI failed → attached triage evidence (failing step, first error line, trace/screenshot link)

> If this PR touches `src/components/**`, E2E validation is expected.

## Risk + rollback

- **Risk:** Low / Med / High
- **Rollback:** <!-- one sentence -->

## Screenshots / artifacts

<!-- Optional. Attach Playwright report link or screenshots for UI changes. -->

## Follow-ups

<!-- Optional. Deferred items or next-PR notes. -->
