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
