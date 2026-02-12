# How to Use the Code Review Prompt

## Quick Start

To get a comprehensive code review of this repository, simply copy and paste the content from `docs/CODE_REVIEW_PROMPT.md` into your AI assistant (GitHub Copilot, Claude, ChatGPT, etc.).

## Usage Options

### Option 1: Full Comprehensive Review
```
Please review my repository using the instructions in docs/CODE_REVIEW_PROMPT.md
```

Then share the full content of `CODE_REVIEW_PROMPT.md` with the AI.

### Option 2: Focused Area Review
If you only want to review specific areas, you can ask:
```
Please review only the Security & Safety section from docs/CODE_REVIEW_PROMPT.md
```

### Option 3: Quick Health Check
For a quick assessment:
```
Run the Quality Gates section from docs/CODE_REVIEW_PROMPT.md and report any failures
```

## Before Running a Review

1. Ensure all dependencies are installed: `pnpm install`
2. Make sure you're on the latest commit: `git pull`
3. Have a clean working directory: `git status` should show no uncommitted changes

## What to Expect

The code review prompt will guide an AI to:
- Review 10 major areas of your codebase
- Run quality gates (build, type checking, linting, tests)
- Provide structured feedback with priority levels
- Highlight both issues and positive patterns

## Output Format

The review will provide:
1. **Executive Summary** - Quick overview
2. **Critical Issues** - Immediate action required
3. **Major Concerns** - Important but not blocking
4. **Minor Issues** - Nice-to-have improvements
5. **Positive Highlights** - What's working well
6. **Recommendations** - Prioritized action items

## When to Run a Review

- Before major releases
- After significant refactoring
- When onboarding new team members
- Weekly as part of quality discipline (per AGENTS.md)
- Before merging large PRs

## Customizing the Prompt

You can edit `docs/CODE_REVIEW_PROMPT.md` to:
- Add project-specific checks
- Focus on particular areas of concern
- Adjust the depth of review
- Include new architectural decisions from DECISIONS.md

## Tips

- Run the review in "read-only" mode first (no changes)
- Address critical and major issues before minor ones
- Use the checklist format to track progress
- Document decisions in DECISIONS.md
- Re-run after making significant changes

---

**Related Documents:**
- `docs/CODE_REVIEW_PROMPT.md` - The actual prompt
- `AGENTS.md` - Agent operating rules
- `docs/AGENT_PLAYBOOK.md` - Detailed guidelines
- `docs/TESTING.md` - Testing strategy
