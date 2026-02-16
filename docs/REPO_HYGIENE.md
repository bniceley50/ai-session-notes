# Repo Hygiene Automation

This repository uses 4 layers of hygiene automation:

1. PR gate: `.github/workflows/repo-hygiene-pr.yml`
2. Nightly deep audit: `.github/workflows/repo-hygiene-nightly.yml`
3. Weekly autofix PR: `.github/workflows/repo-hygiene-weekly-autofix.yml`
4. OpenClaw summary helper script: `tools/hygiene-openclaw-summary.mjs`

## Severity policy

- `P0`/`P1`: blocking on PR hygiene workflow
- `P2`/`P3`: non-blocking findings (tracked in reports)

Nightly workflow opens deduplicated GitHub issues for `P1`/`P2`
findings that are not auto-fixable.

## Local commands

```bash
pnpm hygiene:audit
pnpm hygiene:audit:deep
pnpm hygiene:autofix
pnpm hygiene:openclaw:summary
```

## Workflow schedule

- PR: on every pull request to `main`
- Nightly: daily deep audit
- Weekly autofix: weekly automated cleanup PR
  - If your repo disables bot PR creation, the workflow still succeeds and opens an issue with enablement steps.
  - Optional: set `HYGIENE_PR_TOKEN` (PAT with `contents` + `pull_requests`) to allow PR creation without changing repo-wide Actions policy.

## OpenClaw test flow

Use these commands on your local machine:

```bash
openclaw status --all
pnpm hygiene:openclaw:summary
cat .hygiene/openclaw-summary.md
```

This gives a quick operational check plus a repo hygiene run summary from GitHub.

## Required GitHub secrets

For `.github/workflows/jobs-runner-schedule.yml`:

- `JOBS_RUNNER_ENDPOINT` (full URL to `/api/jobs/runner`)
- Optional fallback: repository variable `JOBS_RUNNER_BASE_URL` (workflow appends `/api/jobs/runner`)
- `JOBS_RUNNER_TOKEN`

If endpoint/token are missing or still set to placeholders, the workflow now
skips invocation with a warning instead of hard-failing every schedule run.

