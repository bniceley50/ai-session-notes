# Release Cut Checklist

## Release metadata

| Field | Value |
|---|---|
| Version / tag | `v0.x.x` |
| Date | YYYY-MM-DD |
| Owner | @bniceley50 |
| Scope summary | _one-line description_ |

---

## Pre-release gate

```bash
# Run all three from repo root
pnpm tsc --noEmit
pnpm exec eslint src/ tests/
pnpm exec playwright test
```

- [ ] Branch is up to date with `main`
- [ ] `pnpm tsc --noEmit` — clean
- [ ] `pnpm exec eslint src/ tests/` — 0 errors
- [ ] `pnpm exec playwright test` — all specs passing
- [ ] CI green on the target merge commit

## Functional smoke test (core loop)

Run manually against the deploy target (staging or production):

- [ ] Dev login works (or real auth if production)
- [ ] Upload audio file
- [ ] Transcription completes — transcript visible
- [ ] Generate SOAP note — draft appears
- [ ] Transfer to Notes — NoteEditor populated
- [ ] Export works (copy / download)
- [ ] Cancel mid-run — UI resets, no lingering state
- [ ] Delete completed job — artifacts cleaned up, UI resets

## Config / security checks

- [ ] Required env vars present in deploy environment
- [ ] No secrets in tracked files (`git diff --stat` to verify)
- [ ] `AUTH_COOKIE_SECRET` set in deploy env
- [ ] API mode flags correct (`AI_ENABLE_REAL_APIS` / `AI_ENABLE_STUB_APIS`)
- [ ] `JOBS_RUNNER_TOKEN` set in deploy env

```bash
# Quick sanity — no untracked secrets
git status -sb
git diff --stat
```

## Deployment steps

- [ ] Squash merge PR to `main`
- [ ] Verify CI passes on merged commit
- [ ] Create Git tag: `git tag v0.x.x && git push origin v0.x.x`
- [ ] Create GitHub release with scope summary and notable changes
- [ ] Post-deploy health check — app loads, login works, no console errors

## Rollback plan

- [ ] Last known good commit identified: `_______________`
- [ ] Rollback method: redeploy previous commit or revert merge
- [ ] Owner assigned for rollback execution: @bniceley50

If rollback is needed:

```bash
# Option A: Revert the merge commit
git revert -m 1 <merge-sha>
git push origin main

# Option B: Redeploy last known good
# (use hosting provider's deploy-to-commit feature)
```

## Post-release validation

- [ ] Monitor CI and error reports for 30–60 minutes
- [ ] Verify core loop works in production (upload → transcribe → note → export)
- [ ] Create follow-up issues for any known non-blockers discovered during release
