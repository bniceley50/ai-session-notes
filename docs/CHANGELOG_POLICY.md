# Changelog Policy

## Purpose

`CHANGELOG.md` is the human-readable release history for users and maintainers. It answers "what changed and why" without requiring anyone to read commit logs.

## When to update

- Update the changelog **at release cut time** (see `docs/RELEASE_CHECKLIST.md`).
- Batch all changes since the last release into one section per release.
- Do not update the changelog on every commit or PR merge.

## What belongs

- User-visible changes (new features, UI changes)
- Behavior changes (API responses, pipeline flow, polling logic)
- New or changed workflows (CI, deployment, auth)
- Security fixes
- Breaking changes (anything that requires user action)

## What does NOT belong

- Pure refactors with no behavior impact
- Formatting-only or whitespace changes
- Internal tooling churn (unless it affects how the app operates)
- Dependency bumps (unless they fix a security issue or change behavior)

## Entry categories

Use these headings in order. Omit empty categories.

| Category | When to use |
|---|---|
| **Added** | New feature or capability |
| **Changed** | Existing behavior modified |
| **Fixed** | Bug fix |
| **Security** | Vulnerability patch or hardening |
| **Breaking** | Requires user action or migration |

## Entry style rules

- One line per change.
- Start with the **outcome**, not the implementation detail.
  - Good: "Upload now accepts MP3 files in addition to WebM"
  - Bad: "Refactored MIME validation regex in AudioInput.tsx"
- Include PR number when available: `(#42)`
- Use plain language — no jargon unless the audience is developers.

## Versioning convention

Use **calendar versioning**: `vYYYY.MM.DD`

- Each release tag matches a changelog section heading.
- If multiple releases happen on the same day, append a suffix: `vYYYY.MM.DD.2`
- Tags are created at release cut (see `docs/RELEASE_CHECKLIST.md`).

## Source of truth inputs

When writing a changelog section, pull from:

1. Merged PR titles since last release (`git log --oneline v<last>..HEAD`)
2. Release checklist outcomes (smoke test results, known issues)
3. CI/release notes from GitHub Releases

## Template

Copy-paste this block when cutting a new release:

```markdown
## [vYYYY.MM.DD] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Security
- ...
```

Remove any empty categories before publishing.

