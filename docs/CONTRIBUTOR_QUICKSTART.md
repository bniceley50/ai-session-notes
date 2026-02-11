# Contributor Quickstart

One-page onboarding for anyone opening a PR against this repo.

---

## 1. Local setup

```bash
# Prerequisites: Node >= 22, pnpm 10.x
corepack enable          # activates the pnpm version pinned in package.json
pnpm install             # install deps (lockfile is committed)
cp .env.example .env     # fill in required values (see comments in file)
pnpm dev                 # start Next.js dev server on localhost:3000
```

> **No `.env.example` yet?** Ask the maintainer — secrets are never committed.

## 2. Required checks

Every PR must pass these before merge. Run them locally to avoid CI surprises:

```bash
pnpm tsc --noEmit              # typecheck (zero errors)
pnpm lint                      # ESLint (zero errors)
pnpm exec playwright test      # E2E — required if UI or selectors changed
```

CI runs the same three checks in a single workflow:
**`E2E – Playwright / Playwright core-loop`**

If any step fails, the PR is blocked.

## 3. PR checklist

The repo ships a PR template (`.github/pull_request_template.md`). Fill in every section — reviewers use it as a merge gate. Key items:

- [ ] `pnpm tsc --noEmit` — clean
- [ ] `pnpm lint` — 0 errors
- [ ] Playwright tests passing (if UI or `data-testid` changed)
- [ ] If `data-testid` changed, update `tests/e2e/selectors.ts`
- [ ] If CI failed, attach triage evidence (failing step + first error line)

## 4. Label workflow

Every issue and PR gets exactly **one** `type:*` label and **one** `priority:*` label. Labels are seed-controlled — do not create labels through the GitHub UI.

Full rules: **[docs/LABEL_TAXONOMY.md](./LABEL_TAXONOMY.md)**

Quick reference:

| Group | Options |
|---|---|
| `type:*` | `feature`, `bug`, `chore`, `docs`, `test`, `ci`, `security`, `refactor` |
| `priority:*` | `p0` (blocker), `p1` (high), `p2` (medium), `p3` (low) |
| `status:*` | `ready`, `in-progress`, `blocked`, `review` |

## 5. CI triage

If CI goes red, start here — most failures resolve in under 60 seconds:

**[docs/CI-TROUBLESHOOTING.md](./CI-TROUBLESHOOTING.md)**

## 6. Release checklist

Cutting a release? Follow the step-by-step:

**[docs/RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)**

## 7. Branch protection

`main` is protected. All PRs require the status check to pass before merge. Details:

**[docs/BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md)**

---

## Quick links

| Doc | What it covers |
|---|---|
| [LABEL_TAXONOMY.md](./LABEL_TAXONOMY.md) | Label groups, seed file, CI enforcement |
| [CI-TROUBLESHOOTING.md](./CI-TROUBLESHOOTING.md) | 60-second CI failure diagnosis |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | Pre-release gate + cut steps |
| [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) | Protected branches + required checks |
| [TESTING.md](./TESTING.md) | Test strategy + Playwright patterns |
| [CHANGELOG_POLICY.md](./CHANGELOG_POLICY.md) | Changelog conventions |
| [AGENT_CONTRACT.md](./AGENT_CONTRACT.md) | AI agent guardrails |
| [AGENT_PLAYBOOK.md](./AGENT_PLAYBOOK.md) | Agent operational playbook |
