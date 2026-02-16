# Testing

# # Goals
- Prevent regressions in session → transcript → note workflow
- Keep API behavior stable (auth, validation, error codes)
- Enable safe refactors

# # What we test (now)
# # # Unit
- token parsing (Bearer header)
- input validation (org name, session ids)
- helper functions (formatting, mapping)

# # # API routes
- 500 "Server misconfigured" when env vars missing
- 401 when missing/invalid bearer token
- 200 on happy path (mocked Supabase)

# # How to run
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm test`

# # Conventions
- Put unit tests next to code: `*.test.ts`
- Keep route tests focused on status codes + response shape
- Do not hit real Supabase in unit tests

# # E2E Selector Conventions

### Source of truth
`tests/e2e/selectors.ts` is the canonical map of every `data-testid` used in E2E specs. If a component renames or adds a test ID, update `selectors.ts` in the same PR.

### Naming prefixes
| Prefix | Purpose | Example |
|---|---|---|
| `action-*` | Clickable buttons / triggers | `action-cancel-job` |
| `panel-*` | Panel-level headers | `panel-header-transcript` |
| `status-*` | Status chip anchors | `status-chip-analysis` |
| `content-*` | Primary content blocks / inputs | `transcript-content` |
| `prompt-*` | Empty-state / CTA prompts | `analysis-ready-prompt` |

### Authoring rules
- Use `getByTestId(TID.…)` for brittle interactive elements (buttons that change label, elements behind conditional renders).
- Keep semantic selectors (`getByRole`, `getByText`) for user-facing assertions where the visible text *is* the thing being tested.
- Never hardcode raw `getByTestId("…")` strings in spec files — always import from `TID`.
- Don't add test IDs to purely decorative elements (icons, dividers, backgrounds).

### PR review checklist
- [ ] New / changed test IDs added to `selectors.ts`
- [ ] No raw `getByTestId("…")` literals in spec files
- [ ] `pnpm exec playwright test` passes

## CI Failure Triage (60 seconds)

When CI goes red, classify the failure before debugging:

1. **Read the failing step** — typecheck, lint, or E2E?
2. **Match to a category below** — most failures fall into one of five buckets.
3. **Run the matching local command** — reproduce before pushing fixes.

### Quick local repro

```bash
# Typecheck
pnpm tsc --noEmit

# Lint (scope to source — global picks up build artifacts)
pnpm exec eslint src/ tests/

# E2E (requires stub env)
AI_ENABLE_STUB_APIS=1 AI_ENABLE_REAL_APIS=0 ALLOW_DEV_LOGIN=1 pnpm exec playwright test
```

### Common symptoms → cause

| Symptom | Likely cause | Fix |
|---|---|---|
| `TS2307: Cannot find module` | Missing / renamed import | Check path, run `pnpm tsc --noEmit` |
| `TS2345: Argument of type …` | Type mismatch after refactor | Align types with canonical `@/lib/jobs/status` |
| Lint errors only in `.next/` or `.claude/` | Build artifacts in scope | Use `pnpm exec eslint src/ tests/` instead of `pnpm lint` |
| E2E timeout on `toBeVisible` | Selector changed or element not rendered | Check component `data-testid` vs `selectors.ts` |
| E2E "strict mode violation" | Multiple elements match selector | Add `.first()` or make selector more specific |
| `ECONNREFUSED` in E2E | Dev server didn't start | Check `playwright.config.ts` webServer block |
| E2E passes locally, fails in CI | Missing env var or OS difference | Compare CI env with local `.env` |

### Escalation rule

If a failure doesn't match the table above, or you can't reproduce locally within 5 minutes:
1. Copy the full CI log output
2. Open an issue with the `ci-failure` label
3. Include: branch name, commit SHA, and the log snippet

