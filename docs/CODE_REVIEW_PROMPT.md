# Code Review Prompt for AI Session Notes Repository

## Repository Overview

This is a Next.js-based clinical documentation MVP that processes session audio through a pipeline: audio → transcript (Whisper API) → AI-drafted provider note (Claude API) → provider edits → copy/export.

**Key Facts:**
- **Tech Stack**: Next.js 16.1.6, React 19, TypeScript, Tailwind CSS, Supabase, pnpm
- **Node Version**: >= 22
- **Purpose**: Dead-simple clinical note drafting to reduce documentation time
- **Data Model**: Ephemeral (24-hour auto-delete by design, not an EHR)
- **AI APIs**: OpenAI Whisper (transcription), Anthropic Claude (note generation)

## Code Review Instructions

Please conduct a comprehensive code review of the `bniceley50/ai-session-notes` repository focusing on the following areas:

### 1. Architecture & Design
- [ ] **API Pipeline**: Review `src/lib/jobs/pipeline.ts` for proper orchestration of Whisper → Claude → file writes
- [ ] **Server-only Secrets**: Verify that API routes requiring secrets properly import `server-only` and run in Node.js runtime
- [ ] **Swappable Providers**: Check if transcription provider abstraction allows for easy swapping (Whisper/Deepgram/etc.)
- [ ] **Job Processing**: Review the duality between development (`setTimeout()` in `/api/jobs/create`) and production (`/api/jobs/runner`) approaches
- [ ] **Ephemeral Design**: Confirm 24-hour TTL implementation and "delete now" functionality

### 2. Security & Safety
- [ ] **Kill Switches**: Verify `AI_ENABLE_REAL_APIS` and `AI_ENABLE_STUB_APIS` flags are correctly implemented to prevent accidental API spending
- [ ] **Secrets Management**: Confirm server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) never leak to client
- [ ] **Auth Cookie**: Check `AUTH_COOKIE_SECRET` is >= 32 chars and properly used for JWT signing
- [ ] **Data Retention**: Verify compliance with stated 24-hour auto-delete policy
- [ ] **Environment Variables**: Review `.env.example` completeness and check for any hardcoded secrets

### 3. Code Quality & Standards
- [ ] **TypeScript**: Run type checking with `pnpm tsc --noEmit` and address any type errors
- [ ] **Linting**: Run `pnpm eslint src/` and verify clean output
- [ ] **Gate Discipline**: Check if `tools/gate.cmd` runs successfully (TypeScript + ESLint)
- [ ] **Complexity**: Look for overly complex functions (especially in pipeline orchestration)
- [ ] **Error Handling**: Verify proper error handling in API routes and async operations
- [ ] **Imports**: Check for consistent import ordering and proper module organization

### 4. Testing Coverage
- [ ] **E2E Tests**: Review Playwright tests in `tests/e2e/` (core-loop, cancel-flow, delete-flow)
- [ ] **Unit Tests**: Check for unit tests matching pattern `src/**/*.test.ts`
- [ ] **Stub Mode**: Verify E2E tests run successfully with `AI_ENABLE_STUB_APIS=1` (no real API calls)
- [ ] **Test Infrastructure**: Validate test setup in `tests/setup-env.ts`
- [ ] **CI Pipeline**: Review `.github/workflows/e2e-playwright.yml` for proper configuration

### 5. UI/UX Implementation
- [ ] **Component Structure**: Review React components in `src/components/` for proper organization
- [ ] **State Management**: Check how notes persist in localStorage keyed by session ID
- [ ] **Date Handling**: Verify YYYY-MM-DD dates are parsed as local dates (avoid timezone drift)
- [ ] **Export Functionality**: Review PDF and text export implementations
- [ ] **Loading States**: Check for proper loading/skeleton states during async operations
- [ ] **Error States**: Verify user-friendly error messages and handling

### 6. API Routes & Data Flow
- [ ] **Job Creation**: Review `/api/jobs/create` route implementation
- [ ] **Job Runner**: Review `/api/jobs/runner` and shared logic in `src/lib/jobs/runner.ts`
- [ ] **File Serving**: Check GET routes for transcript/draft reading
- [ ] **Middleware**: Review `middleware.ts` for auth and routing logic
- [ ] **Error Responses**: Verify consistent error response format across API routes

### 7. Documentation & Maintainability
- [ ] **README Accuracy**: Verify README matches current implementation
- [ ] **DECISIONS.md**: Check that architectural decisions are properly documented
- [ ] **SECURITY.md**: Validate security documentation is authoritative and complete
- [ ] **Code Comments**: Look for necessary comments explaining complex logic (avoid over-commenting)
- [ ] **Agent Contract**: Review `AGENTS.md` and `docs/AGENT_PLAYBOOK.md` for consistency

### 8. Dependencies & Configuration
- [ ] **Package.json**: Review dependencies for unnecessary packages or outdated versions
- [ ] **Lock File**: Verify `pnpm-lock.yaml` is committed and up-to-date
- [ ] **Next.js Config**: Review `next.config.ts` for optimal settings
- [ ] **TypeScript Config**: Check `tsconfig.json` for strict settings
- [ ] **ESLint Config**: Verify `eslint.config.mjs` has appropriate rules

### 9. Performance & Optimization
- [ ] **Bundle Size**: Check for unnecessarily large client-side bundles
- [ ] **API Route Performance**: Review for N+1 queries or inefficient data fetching
- [ ] **File Upload Handling**: Verify efficient handling of audio file uploads
- [ ] **Caching Strategy**: Check if appropriate caching is in place
- [ ] **Database Queries**: Review Supabase query patterns for efficiency

### 10. Known Issues & Technical Debt
- [ ] **Removed Routes**: Confirm legacy routes are properly removed (e.g., stub transcribe route)
- [ ] **TODOs**: Search for TODO/FIXME comments and assess priority
- [ ] **Error Handling**: Look for unhandled promise rejections or missing try-catch blocks
- [ ] **Type Safety**: Identify areas using `any` or type assertions that could be improved
- [ ] **Filesystem Cleanup**: Verify proper cleanup on job cancellation/deletion

## Quality Gates

Before marking the review complete, ensure:

1. ✅ **Build passes**: `pnpm build` completes successfully
2. ✅ **Types pass**: `pnpm tsc --noEmit` shows no errors
3. ✅ **Linting passes**: `pnpm eslint src/` shows no errors
4. ✅ **E2E tests pass**: `pnpm exec playwright test` passes in stub mode
5. ✅ **Unit tests pass**: `pnpm test` completes successfully (if tests exist)

## Review Output Format

Please provide:

1. **Executive Summary**: High-level overview of code quality and major findings
2. **Critical Issues**: Security vulnerabilities, data integrity issues, or breaking bugs (if any)
3. **Major Concerns**: Architectural issues, significant technical debt, or maintainability problems
4. **Minor Issues**: Code style, optimization opportunities, or documentation gaps
5. **Positive Highlights**: Well-implemented features, good patterns, or excellent documentation
6. **Recommendations**: Prioritized list of improvements with estimated effort

## Context Documents to Review

Before starting the review, familiarize yourself with these key documents:
- `README.md` - Project overview and setup
- `AGENTS.md` - Agent contract and operating rules
- `DECISIONS.md` - Locked architectural decisions
- `SECURITY.md` - Security and data handling policy
- `docs/AGENT_PLAYBOOK.md` - Detailed agent guidelines
- `docs/TESTING.md` - Testing strategy and guidelines

## Additional Focus Areas

- **No Edit Default**: The repo follows a READ-ONLY default; check that automated tooling respects this
- **Question Budget**: Code should be self-documenting enough to minimize questions
- **One Change → Gate**: Verify commit discipline follows the "one unit of work then gate" pattern
- **Command Discipline**: Check that any scripts are properly labeled and documented

---

**Last Updated**: 2026-02-12
**Repository**: `bniceley50/ai-session-notes`
**Review Type**: Comprehensive Full-Stack Code Review
