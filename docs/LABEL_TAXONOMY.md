# Label Taxonomy

## Purpose

Labels drive triage, prioritization, and release notes grouping. Consistent labeling means issues and PRs are sortable, filterable, and automatically categorized in GitHub Releases (see `.github/release.yml`).

## Core label groups

### `type:*` — what kind of work

| Label | Description |
|---|---|
| `type:feature` | New capability or user-facing addition |
| `type:bug` | Something broken that worked before |
| `type:chore` | Maintenance, config, tooling (no behavior change) |
| `type:docs` | Documentation only |
| `type:test` | Test additions or changes |
| `type:ci` | CI/CD workflow changes |
| `type:security` | Security fix or hardening |
| `type:refactor` | Code restructuring with no behavior change |

### `priority:*` — how urgent

| Label | Description |
|---|---|
| `priority:p0` | Blocker — drop everything |
| `priority:p1` | High — fix this sprint |
| `priority:p2` | Medium — next sprint |
| `priority:p3` | Low — backlog |

### `status:*` — where it stands

| Label | Description |
|---|---|
| `status:needs-triage` | Not yet categorized or prioritized |
| `status:ready` | Triaged, ready for work |
| `status:blocked` | Waiting on dependency or decision |
| `status:in-progress` | Actively being worked on |

### `area:*` — what part of the codebase

| Label | Description |
|---|---|
| `area:session-ui` | `src/components/session/**` |
| `area:api` | `src/app/api/**` |
| `area:jobs-pipeline` | `src/lib/jobs/**` |
| `area:auth` | `src/lib/auth/**` |
| `area:testing` | `tests/**`, Playwright config |
| `area:docs` | `docs/**`, README, SECURITY |
| `area:github-config` | `.github/**` |

### `risk:*` — impact level (optional)

| Label | Description |
|---|---|
| `risk:low` | Isolated change, easy rollback |
| `risk:medium` | Touches shared code or multiple areas |
| `risk:high` | Breaking change, data model, or auth |

## Release-note label mapping

These labels feed into `.github/release.yml` categories. Must stay aligned with `docs/CHANGELOG_POLICY.md`.

| Release section | Labels |
|---|---|
| **Added** | `feature`, `enhancement` |
| **Changed** | `changed`, `refactor` |
| **Fixed** | `bug`, `fix` |
| **Security** | `security` |
| **Breaking** | `breaking` |

> **Note:** The release-note labels above are _unprefixed_ (e.g. `bug`, not `type:bug`) because `.github/release.yml` matches on exact label names. When labeling a PR, apply both the prefixed `type:*` label for triage and the unprefixed label for release note grouping.

## Label usage rules

- At least 1 `type:*` label on every issue and PR.
- Max 1 `priority:*` label.
- Max 1 `status:*` label.
- At least 1 `area:*` label preferred.
- Add the matching unprefixed release-note label on PRs that should appear in release notes.

## Examples

| Scenario | Labels |
|---|---|
| Bug in transcript polling | `type:bug`, `bug`, `area:jobs-pipeline`, `priority:p1`, `status:ready` |
| CI flake in Playwright | `type:ci`, `area:testing`, `priority:p2` |
| New export feature | `type:feature`, `feature`, `area:session-ui`, `priority:p1` |
| Security patch in auth | `type:security`, `security`, `area:auth`, `priority:p0` |
| Docs-only update | `type:docs`, `area:docs`, `priority:p3` |
