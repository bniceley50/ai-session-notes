# CI Troubleshooting — 60-Second Diagnosis

When the E2E workflow fails, work through this flowchart top-to-bottom.
Most failures resolve at step 1 or 2.

---

## Flowchart

### 1. Did the dev server start?

Look for `ECONNREFUSED` or timeout before the first page load.

- **Yes (connection error):** Usually a missing env var or config startup crash.
  Check the "Install dependencies" and "Run Playwright tests" step logs for
  Node/Next.js startup errors.
- **No (server started fine):** Move to step 2.

### 2. Did auth succeed?

The E2E test navigates to `/api/auth/dev-login` first. If subsequent requests
return 401, the session cookie wasn't set.

**Check these env vars in the workflow:**

| Variable | Required value |
|---|---|
| `AUTH_COOKIE_SECRET` | Any string >= 32 chars |
| `SESSION_TTL_SECONDS` | Any positive number (e.g. `3600`) |
| `ALLOW_DEV_LOGIN` | `1` |
| `DEFAULT_PRACTICE_ID` | Any non-empty string |

### 3. Did the upload step fail?

- **File input timeout:** Selector or layout problem. Verify `input[type="file"]`
  is present on the page. Check viewport config in `playwright.config.ts`.
- **Upload request fails (4xx/5xx):** Route auth, session, or API validation issue.
  Check the server logs in the Playwright report.

### 4. Did transcribe/analyze stall?

If waiting for transcript or draft text times out:

- Check request statuses for `/api/jobs/*`, `/transcript`, `/draft` in the trace.
- Confirm stub mode env is correct:
  - `AI_ENABLE_STUB_APIS=1`
  - `AI_ENABLE_REAL_APIS=0`
- If real APIs are accidentally enabled, the test will either hang (waiting for
  real API response) or fail with auth errors.

### 5. Was it flaky (pass on retry)?

- If pass on retry but fail on first run: inspect the trace/video for
  timing or actionability issues.
- Don't ignore repeated retry-only failures — they indicate a real problem.
- Keep retries at 1-2 max.

### 6. Was the failure from lint/typecheck, not E2E?

Check the **step name** in the GitHub Actions log:

- `Type check` — TypeScript error. Run `pnpm tsc --noEmit` locally.
- `Lint` — ESLint error. Run `pnpm eslint src/` locally.
- `Validate label seed (strict)` — Label ordering or format error. Run `pnpm labels:check:strict` and re-sort `.github/labels.json` alphabetically by name.
- `Run Playwright tests` — Actual E2E failure. Download the report artifact.

---

## Fast triage matrix

| Symptom | Likely cause |
|---|---|
| 401 everywhere | Auth env vars missing or wrong |
| `ERR_CONNECTION_REFUSED` | Next.js server didn't start |
| Click intercepted / not clickable | Viewport/layout/actionability |
| Transcript/draft never appears | Stub mode env mismatch or polling timing |
| Only CI fails, local passes | Linux/headless timing + env differences |

---

## What to capture before re-running

1. **Failing step name** (from GitHub Actions log)
2. **First failing request URL + status** (from Playwright trace)
3. **One screenshot** (from test artifacts or trace)
4. **Playwright report artifact link** (uploaded automatically)
5. **Whether retry passed** (check retry count in test output)

This is usually enough to diagnose the issue without a second run.

---

## Useful commands

```bash
# Run E2E locally in stub mode (matches CI)
pnpm exec playwright test

# Run with headed browser for debugging
pnpm exec playwright test --headed

# Run with trace on (always, not just on retry)
pnpm exec playwright test --trace on

# View the last test report
pnpm exec playwright show-report
```

---

## CI workflow location

`.github/workflows/e2e-playwright.yml`

The workflow runs on every PR to `main` and on push to `main`.
All env vars are dummy values — no GitHub Secrets required.

