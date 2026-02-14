# Code Review Prompt - Quick Reference

## 📋 What Was Created

Two new documentation files for conducting AI-powered code reviews:

1. **`docs/CODE_REVIEW_PROMPT.md`** (132 lines)
   - Comprehensive code review instructions
   - 10 focus areas covering all aspects of the codebase
   - Quality gates checklist
   - Output format specification

2. **`docs/CODE_REVIEW_USAGE.md`** (82 lines)
   - How to use the review prompt
   - Usage options and examples
   - When to run reviews
   - Customization tips

## 🎯 Quick Start

To get a code review, copy this prompt to your AI assistant:

```
Please conduct a comprehensive code review of the bniceley50/ai-session-notes 
repository following the instructions in docs/CODE_REVIEW_PROMPT.md

Focus on:
1. Architecture & Design
2. Security & Safety
3. Code Quality & Standards
4. Testing Coverage
5. UI/UX Implementation
6. API Routes & Data Flow
7. Documentation & Maintainability
8. Dependencies & Configuration
9. Performance & Optimization
10. Known Issues & Technical Debt

Run these quality gates:
- pnpm build
- pnpm tsc --noEmit
- pnpm eslint src/
- pnpm exec playwright test
- pnpm test

Provide output in this format:
1. Executive Summary
2. Critical Issues
3. Major Concerns
4. Minor Issues
5. Positive Highlights
6. Recommendations
```

## 🔍 Review Areas

| Area | Key Checks |
|------|------------|
| **Architecture** | Pipeline orchestration, server-only secrets, swappable providers |
| **Security** | Kill switches, secrets management, auth cookie, data retention |
| **Code Quality** | TypeScript, linting, gate discipline, error handling |
| **Testing** | E2E tests, unit tests, stub mode, CI pipeline |
| **UI/UX** | Components, state management, date handling, exports |
| **API Routes** | Job creation, runner logic, file serving, middleware |
| **Documentation** | README accuracy, DECISIONS.md, SECURITY.md |
| **Dependencies** | Package versions, lock file, configs |
| **Performance** | Bundle size, query efficiency, caching |
| **Tech Debt** | Removed routes, TODOs, type safety, cleanup |

## ✅ Quality Gates

Must pass before review completion:
- ✅ Build succeeds
- ✅ Type checking passes
- ✅ Linting passes
- ✅ E2E tests pass (stub mode)
- ✅ Unit tests pass

## 📚 Context Documents

Review these first:
- `README.md` - Project overview
- `AGENTS.md` - Operating rules
- `DECISIONS.md` - Architectural decisions
- `SECURITY.md` - Security policy
- `docs/AGENT_PLAYBOOK.md` - Detailed guidelines

## 🎓 Tips

- Run in read-only mode first
- Address critical → major → minor
- Use checklist format to track
- Document decisions in DECISIONS.md
- Re-run after significant changes

---

**Created**: 2026-02-12  
**Repository**: bniceley50/ai-session-notes  
**No code was modified** - only documentation added
