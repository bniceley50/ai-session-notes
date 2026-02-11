# Branch Protection Policy

## Protected branches

| Branch | Protection level |
|---|---|
| `main` | Full protection (rules below) |

## Required status checks

PRs targeting `main` must pass these checks before merge:

| Check name (as shown in Actions) | What it verifies |
|---|---|
| `E2E – Playwright / Playwright core-loop` | Typecheck, lint, and Playwright E2E in stub mode |

> The single workflow runs typecheck (`pnpm tsc --noEmit`), lint (`pnpm eslint src/`), and Playwright tests sequentially. All three must pass for the check to go green.

## Review requirements

- At least **1 approving review** required.
- **CODEOWNERS review required** — the owner listed in `.github/CODEOWNERS` is auto-requested.
- Dismiss stale approvals when new commits are pushed.
- All review conversations must be resolved before merge.

## Push restrictions

- **No direct pushes to `main`** — all changes go through PRs.
- Force-push to `main` is disabled.
- Branch deletion of `main` is disabled.

## Merge strategy

- **Squash merge** preferred — keeps `main` history clean.
- Delete source branch after merge.
- PR title becomes the squash commit message (follow conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`).

## Admin bypass policy

Admins **can** bypass protection only when:
1. CI is broken and the fix itself can't pass checks (circular failure).
2. A time-critical security patch must land immediately.

After any bypass:
- Open a follow-up issue explaining why the bypass was needed.
- Verify CI passes on the next commit to `main`.

## Emergency / hotfix flow

1. Create a `hotfix/` branch from `main`.
2. Apply the minimal fix.
3. If CI is functional, merge via normal PR flow.
4. If CI is broken (the reason for the hotfix), use admin bypass, then:
   - Open a backfill PR that adds a test proving the fix works.
   - Confirm CI is green on that backfill PR before considering the hotfix complete.

## GitHub settings checklist

Use this when configuring branch protection in **Settings → Branches → Branch protection rules → `main`**:

- [ ] Require a pull request before merging
- [ ] Require approvals (minimum: 1)
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require review from Code Owners
- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging
- [ ] Status check: `Playwright core-loop`
- [ ] Require conversation resolution before merging
- [ ] Do not allow bypassing the above settings *(recommended — disable only for emergencies)*
- [ ] Restrict who can push to matching branches
- [ ] Do not allow force pushes
- [ ] Do not allow deletions
