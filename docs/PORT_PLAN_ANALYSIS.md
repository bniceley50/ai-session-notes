# Port Plan Analysis: legal-notes-mobile → ai-session-notes

> Generated 2026-03-01 by read-only codebase analysis.
> Source: `/home/user/legal-notes-mobile` (legal-notes-mobile iOS client)
> Target: `/home/user/ai-session-notes` (AI Session Notes MVP — Next.js backend + web UI)

---

## 1. Repo Intent Summary

### ai-session-notes (Target)

| # | Bullet |
|---|--------|
| 1 | Next.js 16 App Router + Supabase + Vercel — full-stack web app |
| 2 | Core loop: session audio → Whisper transcription → Claude note drafting → clinician edits → copy/export |
| 3 | Healthcare focus: SOAP, DAP, BIRP, GIRP, Intake, Progress note templates (`src/lib/jobs/claude.ts:20-69`) |
| 4 | Cookie-based session auth (signed JWT in httpOnly cookie, `src/lib/auth/session.ts`) |
| 5 | Filesystem-based job artifact storage with 24h TTL auto-purge (`src/lib/jobs/purge.ts`) |
| 6 | Export: copy-to-clipboard, .txt, .docx, .pdf (`src/components/session/NoteEditor.tsx:249-322`) |
| 7 | Job pipeline with kill switch (AI_ENABLE_REAL_APIS / AI_ENABLE_STUB_APIS) and chunked transcription for large files (`src/lib/jobs/pipeline.ts`) |
| 8 | Scheduler: Vercel cron every 15 min hits `/api/jobs/runner` for purge + queued job processing (`vercel.json`) |
| 9 | Comprehensive governance: AGENTS.md, AGENT_CONTRACT.md, AGENT_PLAYBOOK.md, SECURITY.md, PENTEST_CHECKLIST.md, BRANCH_PROTECTION.md, RELEASE_CHECKLIST.md |
| 10 | 19+ test files, Playwright E2E, repo hygiene automation (PR gate, nightly audit, weekly autofix) |

### legal-notes-mobile (Source)

| # | Bullet |
|---|--------|
| 1 | React 19 + Vite 6 + Capacitor 7 — iOS-native client app, no backend logic |
| 2 | Consumes legal-notes-v1 backend (deployed on Vercel) via Bearer token auth (`src/lib/api.ts`) |
| 3 | Native audio recording via `capacitor-voice-recorder` (M4A format, AVAudioRecorder) (`src/lib/audio/recorder.ts`) |
| 4 | 3-step signed-URL upload flow with XHR progress tracking (`src/lib/audio/uploader.ts`) |
| 5 | Job polling at 3s intervals, auto-switch to results on completion (`src/screens/SessionScreen.tsx:68-100`) |
| 6 | Mediation-focused: hardcoded `noteType: "mediation"` in job creation (`src/screens/SessionScreen.tsx:145`) |
| 7 | OAuth deep link flow: `legalnotes://auth-callback?token=<jwt>` (`src/App.tsx`, `ios/App/App/Info.plist`) |
| 8 | Simple 3-tab UI: Record → Transcript → Notes (`src/components/TabBar.tsx`) |
| 9 | No governance docs beyond CLAUDE.md; no tests; no CI workflows |
| 10 | No security audit, no production runbook, no triad operating model |

### Extra Content in legal-notes-mobile (vs. ai-session-notes)

| Document / Pattern | Present in legal-notes-mobile | Present in ai-session-notes |
|---|---|---|
| `DRY_RUN_CHECKLIST.md` | **Not found** | Not found |
| `PRODUCTION_RUNBOOK.md` | **Not found** | Partial — `RELEASE_CHECKLIST.md` covers deploy |
| `SECURITY-AUDIT-2026-02-17.md` | **Not found** | Not found — but `PENTEST_CHECKLIST.md` + `PENTEST_PROMPT.md` exist |
| `TRIAD_OPERATING_MODEL.md` | **Not found** | Not found |
| Ralph Loop remediation files | **Not found** | Not found |
| Mobile Bearer token auth | **Yes** (`src/lib/auth.ts`) | No — uses cookie-based auth only |
| Native audio recording | **Yes** (`capacitor-voice-recorder`) | No — uses browser `MediaRecorder` |
| Signed-URL upload pattern | **Yes** (`src/lib/audio/uploader.ts`) | Partial — direct POST upload only |
| Typed API client with error classes | **Yes** (`src/lib/api.ts`, 417 lines) | No dedicated client; routes call fetch inline |

> **Important finding (updated 2026-03-01):** Remote analysis of `bniceley50/legal-notes-v1` (private repo, file listing only — contents not readable without auth) confirms:
>
> **Found in legal-notes-v1 (portable to ai-session-notes):**
> - `SECURITY-AUDIT-2026-02-17.md` — security audit document
> - `SECURITY_FINDINGS_VALIDATED.md` — validated security findings
> - `CONTINUITY.md` — agent continuity / handoff protocol
> - `SESSION_HANDOFF.md` — session handoff document
> - `AGENTS.md`, `CONTEXT.md`, `DECISIONS.md`, `NEXT.md` — governance docs
> - `JOURNAL/WRAPUPS/` — session journal/wrapup entries
> - `SKILLS/`, `.agent/workflows/`, `.codex/skills/` — agent tooling configs
> - `scripts/`, `tools/` — utility scripts
>
> **NOT found in ANY of the 3 repos (legal-notes-v1, legal-notes-mobile, ai-session-notes):**
> - `DRY_RUN_CHECKLIST.md` — does not exist
> - `PRODUCTION_RUNBOOK.md` — does not exist
> - `TRIAD_OPERATING_MODEL.md` — does not exist
> - Ralph Loop files — do not exist
>
> **Action required:** Clone legal-notes-v1 locally (or authorize the git proxy) to read file contents and complete the port of security audit, continuity, and session handoff docs.

---

## 2. High-Signal Diff Summary

| Area | ai-session-notes | legal-notes-mobile | Delta / Takeaway |
|---|---|---|---|
| **UI Routes/Pages** | Next.js App Router: `/` (sessions list), `/sessions/[sessionId]` (workspace), `/login` | Capacitor SPA: `LoginScreen`, `SessionScreen` (3 tabs: Record/Transcript/Notes) | Mobile has simpler UX; ASN already has richer workspace with 4 panels |
| **API Routes** | 20 route files under `src/app/api/` (auth, jobs CRUD, sessions, notes, health, purge, runner, bootstrap) | No API routes — client-only app consuming 12+ backend endpoints | Mobile's typed API client (`api.ts`) is a useful pattern; ASN has inline fetch calls |
| **Auth/Session** | Cookie-based JWT (`jose` lib), httpOnly+Secure+SameSite=Lax, `src/lib/auth/session.ts` | Bearer token auth (Capacitor Preferences), `src/lib/auth.ts` | Mobile adds mobile auth path (Bearer token + deep link OAuth). ASN needs this if mobile client is planned |
| **Storage Layout** | `.artifacts/sessions/<sessionId>/jobs/<jobId>/` on filesystem + Supabase `notes` table | No local storage — all server-side | Same backend storage model applies |
| **Job Pipeline** | Full pipeline: upload → Whisper → Claude → file writes. Kill switch, chunked transcription, lock files (`src/lib/jobs/pipeline.ts`) | Job creation via POST + polling at 3s. Hardcoded `noteType: "mediation"` | Mobile sends `noteType: "mediation"` — needs healthcare mapping |
| **Note Templating** | 6 clinical note types: SOAP, DAP, BIRP, GIRP, Intake, Progress (`src/lib/jobs/claude.ts:8,20-69`) + Freeform in UI | Single `"mediation"` note type sent to backend | ASN already has healthcare templates; mobile needs to send correct types |
| **Export Logic** | Client-side: clipboard, .txt, .docx (`docx` lib), .pdf (`jsPDF`), `src/components/session/NoteEditor.tsx` | No export — read-only display of AI draft notes (`src/components/NoteView.tsx`) | Mobile lacks export entirely. Useful port: add export to mobile |
| **Config/Env Vars** | 18 env vars in `.env.example`, validated at startup via `validateConfig()` in `src/lib/config.ts` | Single `VITE_API_BASE_URL` env var | ASN has much richer config; mobile is thin client |
| **Governance/Security** | AGENTS.md, AGENT_CONTRACT.md, AGENT_PLAYBOOK.md, SECURITY.md, PENTEST_CHECKLIST.md, PENTEST_PROMPT.md, BRANCH_PROTECTION.md, RELEASE_CHECKLIST.md, REPO_HYGIENE.md, 5 CI workflows | CLAUDE.md only, no CI, no tests, no security docs | Major gap in mobile repo — needs governance docs ported |
| **Testing** | 19+ test files (unit + E2E Playwright), `pnpm test` + `playwright test` | Zero tests | Mobile needs test infrastructure |
| **Scheduler/Cron** | Vercel cron every 15 min (`vercel.json`), `processQueuedJobs()` + `purgeExpiredJobArtifacts()` | No scheduler (client-only) | N/A for mobile client |
| **Security Hardening** | Cookie flags (httpOnly, secure, SameSite), path validation (`safePathSegment`), config validation, PHI logging hygiene, PENTEST checklist | Bearer token rotation on 401, clearAuth on expiry | Mobile has basic 401 handling; no CSP, no rate limiting, no security audit |

---

## 3. Port Candidates (Ranked)

### MUST PORT NOW

| # | Feature | Source File(s) | Target Location | Rationale |
|---|---------|---------------|-----------------|-----------|
| 1 | **Healthcare note type in mobile** — Replace `noteType: "mediation"` with healthcare dropdown (SOAP/DAP/BIRP/GIRP/Intake/Progress) | `legal-notes-mobile/src/screens/SessionScreen.tsx:145` | Same file | The mobile app hardcodes a legal note type that doesn't exist in the ASN backend. This blocks any mobile → backend integration |
| 2 | **Typed API client pattern** — Structured error classes, typed response interfaces, auto 401 handling | `legal-notes-mobile/src/lib/api.ts` (full file) | `ai-session-notes/src/lib/api/client.ts` (new) | ASN routes use inline fetch; a shared typed client reduces boilerplate and standardizes error handling |
| 3 | **Export capability in mobile** — Add copy-to-clipboard and download for draft notes | `ai-session-notes/src/components/session/NoteEditor.tsx:249-322` (reference) | `legal-notes-mobile/src/components/NoteView.tsx` | Mobile shows notes read-only; users need to copy/share notes on device |
| 4 | **Mobile auth path** — Bearer token auth endpoint + deep link OAuth flow | `legal-notes-mobile/src/lib/auth.ts`, `api.ts:149-154` | `ai-session-notes/src/app/api/auth/mobile-login/route.ts` (new) | ASN backend only has cookie auth; mobile clients need Bearer token endpoint |
| 5 | **Signed-URL upload pattern** — 3-step upload with progress tracking | `legal-notes-mobile/src/lib/audio/uploader.ts` | `ai-session-notes/src/app/api/sessions/[sessionId]/audio/upload-url/route.ts` (new) | Current ASN direct upload has no progress feedback; signed-URL pattern is production-grade |
| 6 | **Environment variable matrix doc** — Document all env vars for both web and mobile in one place | `ai-session-notes/.env.example`, `legal-notes-mobile/CLAUDE.md:63-71` | `ai-session-notes/docs/ENV_MATRIX.md` (new) | Prevents config drift between web + mobile deployments |

### SHOULD PORT SOON

| # | Feature | Source | Rationale |
|---|---------|--------|-----------|
| 7 | **Mobile CLAUDE.md governance** — Add AGENTS.md, SECURITY.md, BRANCH_PROTECTION.md to mobile repo | `ai-session-notes/docs/` | Mobile repo has only CLAUDE.md; needs parity for multi-agent workflow |
| 8 | **CI/testing for mobile** — Add typecheck + lint CI workflow | `ai-session-notes/.github/workflows/` | Mobile has `npm run typecheck` and `npm run lint` but no CI to enforce them |
| 9 | **CORS config for mobile** — Ensure ASN backend allows `capacitor://localhost` origin | Backend config needed | Mobile CLAUDE.md notes backend must allow Capacitor origin |
| 10 | **UI label rebrand** — Replace "Legal Notes" header, "mediation sessions" mic prompt, `legalnotes://` URL scheme | Multiple files in legal-notes-mobile | Legal terminology throughout the mobile app |
| 11 | **Note type selector in mobile** — Add dropdown matching ASN's `NOTE_TYPES` array | `ai-session-notes/src/components/session/NoteEditor.tsx:21-29` | Mobile currently has no way for users to choose note type |

### LATER / IGNORE

| # | Item | Reason |
|---|------|--------|
| 12 | Triad Operating Model (Codex/Claude/Opus) | **Not found in any of the 3 repos.** Does not exist yet — may need to be authored fresh |
| 13 | Ralph Loop remediation pattern | **Not found in any of the 3 repos.** Does not exist yet |
| 14 | Production Runbook / Dry Run Checklist | **Not found in any of the 3 repos.** ASN has `RELEASE_CHECKLIST.md` as partial substitute |
| 15 | Security Audit doc | **Found in legal-notes-v1** as `SECURITY-AUDIT-2026-02-17.md` + `SECURITY_FINDINGS_VALIDATED.md`. Needs clone access to read and port |
| 15a | Continuity / Session Handoff docs | **Found in legal-notes-v1** as `CONTINUITY.md` + `SESSION_HANDOFF.md`. Needs clone access to read and port |
| 15b | Agent tooling (SKILLS/, .agent/workflows/, .codex/skills/) | **Found in legal-notes-v1**. Needs clone access to evaluate portability |
| 16 | CocoaPods / Xcode project files | iOS-specific build config; irrelevant to Next.js backend |
| 17 | Capacitor native plugins (haptics, splash screen, status bar) | iOS-specific; not applicable to web app |
| 18 | Mediation-specific UI copy / legal terminology | Must be **replaced**, not ported |

---

## 4. Terminology Mapping & Edit Surface

### Mapping Table (29 pairs)

| # | Legal Term | Healthcare Equivalent | Where It Appears |
|---|-----------|----------------------|-----------------|
| 1 | `mediation` | `clinical session` | `SessionScreen.tsx:145` (noteType), `Info.plist` (mic description) |
| 2 | `mediation sessions` | `clinical sessions` / `patient sessions` | `Info.plist` NSMicrophoneUsageDescription |
| 3 | `party` / `parties` | `patient` / `patients` | Not found in current repos (likely in legal-notes-v1 backend) |
| 4 | `matter` | `session` / `encounter` | `ai-session-notes/README.md:8` ("attorney matter note") |
| 5 | `attorney` | `clinician` / `provider` | `ai-session-notes/README.md:7-8` |
| 6 | `legal intake` | `clinical intake` | `ai-session-notes/README.md:6` |
| 7 | `Legal Notes` | `Session Notes` / `AI Session Notes` | `legal-notes-mobile/src/screens/SessionScreen.tsx:198`, `index.html:11`, `capacitor.config.ts` |
| 8 | `legalnotes://` | `sessionnotes://` or `aisessionnotes://` | `Info.plist` (URL scheme), `src/App.tsx` (deep link handler) |
| 9 | `com.legalnotes.mobile` | `com.aisessionnotes.mobile` | `capacitor.config.ts` (appId) |
| 10 | `legal-notes-v1` | `ai-session-notes` | `CLAUDE.md:5` (backend reference) |
| 11 | `legal-notes-mobile` | `ai-session-notes-mobile` | `package.json:2` (name) |
| 12 | `matter note` | `clinical note` / `session note` | `README.md:8` |
| 13 | `EHR-friendly text` | *(keep as-is — EHR is healthcare)* | `ai-session-notes/DECISIONS.md:31` |
| 14 | `practiceId` | *(keep as-is — practices exist in healthcare)* | `ai-session-notes/src/lib/auth/session.ts:13`, multiple API files |
| 15 | `org_id` | *(keep as-is — generic)* | `supabase/migrations/...sql` |
| 16 | `clinician` | *(keep as-is — already healthcare)* | `CONTEXT.md:10`, `SECURITY.md:15` |
| 17 | `SOAP/DAP/BIRP` | *(keep as-is — already healthcare)* | `src/lib/jobs/claude.ts` |
| 18 | `case manager` | *(keep as-is)* | `CONTEXT.md:10` |
| 19 | `dispute` | `presenting problem` | Not in current repos |
| 20 | `agreement` | `treatment plan` | Not in current repos |
| 21 | `settlement` | `discharge plan` | Not in current repos |
| 22 | `counsel` | `provider` / `practitioner` | Not in current repos |
| 23 | `deposition` | `assessment` | Not in current repos |
| 24 | `filing` | `documentation` | Not in current repos |
| 25 | `jurisdiction` | `care setting` | Not in current repos |
| 26 | `client` (legal) | `patient` / `client` (clinical) | Context-dependent |
| 27 | `docket` | `schedule` / `case load` | Not in current repos |
| 28 | `pleading` | `progress note` | Not in current repos |
| 29 | `verdict` | `outcome` / `disposition` | Not in current repos |

### Edit Surface Summary

**Files requiring legal→healthcare terminology changes (in legal-notes-mobile):**

| File | Changes Needed |
|------|---------------|
| `src/screens/SessionScreen.tsx:145,198` | `noteType: "mediation"` → dropdown; `"Legal Notes"` → `"Session Notes"` |
| `index.html:11` | `<title>Legal Notes</title>` → `<title>AI Session Notes</title>` |
| `capacitor.config.ts:4-5` | `appId`, `appName` |
| `ios/App/App/Info.plist` | `NSMicrophoneUsageDescription`, `CFBundleURLTypes` URL scheme |
| `src/App.tsx` | Deep link URL scheme check |
| `package.json:2` | Package name |
| `CLAUDE.md:1,5,8` | Project name, backend reference |

**Files in ai-session-notes with stale legal terminology:**

| File | Line(s) | Issue |
|------|---------|-------|
| `README.md:6-8` | "legal intake documentation", "attorney matter note" | Should say "clinical" or "healthcare" |

---

## 5. Minimal Port Plan (with Stop Line)

### Approach: File-by-File Patch

Since the repos have separate git histories, use a **copy-and-adapt** strategy rather than git cherry-pick. Each step copies a file, renames terms, and validates.

### Sequence

#### Phase 1: Fix the README (5 min)

**Goal:** Correct stale legal terminology in ai-session-notes itself.

| Step | Action | File |
|------|--------|------|
| 1.1 | Replace "legal intake documentation" with "clinical session documentation" | `ai-session-notes/README.md:6` |
| 1.2 | Replace "attorney matter note → attorney edits" with "AI-drafted clinical note → clinician edits" | `ai-session-notes/README.md:7-8` |

#### Phase 2: Mobile Healthcare Rebrand (20 min)

**Goal:** Make legal-notes-mobile usable with the ASN backend.

| Step | Action | Source → Target |
|------|--------|----------------|
| 2.1 | Replace hardcoded `noteType: "mediation"` with a state variable defaulting to `"soap"` and add a note type picker UI | `legal-notes-mobile/src/screens/SessionScreen.tsx:145` |
| 2.2 | Add `NOTE_TYPES` array matching ASN types: `soap`, `dap`, `birp`, `girp`, `intake`, `progress` | New constant in `SessionScreen.tsx` or shared `lib/constants.ts` |
| 2.3 | Replace UI title "Legal Notes" → "Session Notes" | `SessionScreen.tsx:198`, `index.html:11` |
| 2.4 | Update `capacitor.config.ts`: `appId` → `com.sessionnotes.mobile`, `appName` → `Session Notes` | `capacitor.config.ts` |
| 2.5 | Update `package.json` name → `session-notes-mobile` | `package.json` |

**Dependencies:** None — these are UI/config-only changes.

#### Phase 3: Add Mobile Auth Endpoint to ASN Backend (30 min)

**Goal:** Enable the mobile app to authenticate against ASN.

| Step | Action | File |
|------|--------|------|
| 3.1 | Create `POST /api/auth/mobile-login` route accepting `{ email, password }` and returning `{ token, expiresAt, user }` | `ai-session-notes/src/app/api/auth/mobile-login/route.ts` (new) |
| 3.2 | Add Bearer token verification in middleware alongside cookie auth | `ai-session-notes/middleware.ts` — add `Authorization: Bearer` header check |
| 3.3 | Add CORS config allowing `capacitor://localhost` | `ai-session-notes/next.config.ts` or middleware |

**Dependencies:** `AUTH_COOKIE_SECRET` (already exists).

#### Phase 4: Add Signed-URL Upload (45 min)

**Goal:** Enable progress-tracked uploads from mobile.

| Step | Action | File |
|------|--------|------|
| 4.1 | Create `POST /api/sessions/[sessionId]/audio/upload-url` route | `ai-session-notes/src/app/api/sessions/[sessionId]/audio/upload-url/route.ts` (new) |
| 4.2 | Create `POST /api/sessions/[sessionId]/audio/confirm` route | `ai-session-notes/src/app/api/sessions/[sessionId]/audio/confirm/route.ts` (new) |
| 4.3 | Reference upload pattern from `legal-notes-mobile/src/lib/audio/uploader.ts` | Copy 3-step logic |

**Dependencies:** Storage backend must support pre-signed URLs (S3 or Supabase Storage).

#### Phase 5: Export in Mobile (20 min)

**Goal:** Add copy/share capability for notes on mobile.

| Step | Action | File |
|------|--------|------|
| 5.1 | Add "Copy to Clipboard" button to `NoteView.tsx` | `legal-notes-mobile/src/components/NoteView.tsx` |
| 5.2 | Add native share via `@capacitor/share` plugin | `legal-notes-mobile/src/components/NoteView.tsx` |

**Dependencies:** `@capacitor/share` package.

#### Phase 6: Governance Docs for Mobile (15 min)

**Goal:** Bring mobile repo governance to parity.

| Step | Action | Source → Target |
|------|--------|----------------|
| 6.1 | Copy and adapt SECURITY.md | `ai-session-notes/SECURITY.md` → `legal-notes-mobile/SECURITY.md` |
| 6.2 | Copy BRANCH_PROTECTION.md | `ai-session-notes/docs/BRANCH_PROTECTION.md` → `legal-notes-mobile/docs/BRANCH_PROTECTION.md` |
| 6.3 | Add basic CI workflow (typecheck + lint) | `ai-session-notes/.github/workflows/` → adapted for `npm` |

**Dependencies:** GitHub repo settings for branch protection.

### --- STOP LINE ---

**The following will NOT be done in this port:**

- **Triad Operating Model, Ralph Loop, Production Runbook, Security Audit, Dry Run Checklist** — These documents were not found in legal-notes-mobile. They likely exist in the legal-notes-v1 backend repo, which is not available on this machine. A separate analysis pass against legal-notes-v1 is required.
- **Supabase schema changes** — The existing schema (`supabase/migrations/20260121153000_db_schema_rls.sql`) already supports healthcare note types via the generic `note_type text` column. No migration needed.
- **Rate limiting / HTTP security headers** — ASN has a pentest checklist tracking these as gaps; they should be addressed in a dedicated security hardening sprint, not as part of this port.
- **Test coverage for mobile** — Adding comprehensive tests to legal-notes-mobile is out of scope for this port; tracked as "SHOULD PORT SOON".
- **Native audio recording changes** — The `capacitor-voice-recorder` integration works as-is; no changes needed.
- **Production deployment** — This port prepares code changes; deployment is a separate operation covered by `RELEASE_CHECKLIST.md`.

---

## 6. Verification Checklist

### ai-session-notes (Next.js backend)

```powershell
# Navigate to repo
Set-Location N:\asn\ai-session-notes

# Install dependencies
pnpm install

# TypeScript check
pnpm tsc --noEmit
# Expected: 0 errors

# Lint
pnpm eslint src/
# Expected: 0 errors

# Unit tests
pnpm test
# Expected: all passing

# E2E tests (stub mode — no API spend)
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test
# Expected: all specs passing

# Build (catches runtime issues)
pnpm build
# Expected: clean build, no warnings

# Smoke test: start dev server
pnpm dev
# In another terminal:
Invoke-WebRequest -Uri http://localhost:3000/api/health | Select-Object -ExpandProperty Content
# Expected: {"status":"ok","timestamp":"..."}

# Smoke test: core loop (stub mode)
# 1. Set AI_ENABLE_STUB_APIS=1 in .env.local
# 2. Open http://localhost:3000
# 3. Dev login -> create session -> upload audio -> verify transcript appears -> verify note generated -> copy/export
```

### legal-notes-mobile (iOS client)

```powershell
# Navigate to repo
Set-Location N:\legal-notes-mobile

# Install dependencies
npm install

# TypeScript check
npm run typecheck
# Expected: 0 errors

# Lint
npm run lint
# Expected: 0 errors, 0 warnings

# Build (Vite production build)
npm run build
# Expected: clean build in dist/

# Verify healthcare rebrand
Select-String -Path src\screens\SessionScreen.tsx -Pattern "mediation"
# Expected: 0 matches (replaced with healthcare term)

Select-String -Path src\screens\SessionScreen.tsx -Pattern "Legal Notes"
# Expected: 0 matches (replaced with "Session Notes")

Select-String -Path index.html -Pattern "Legal Notes"
# Expected: 0 matches

# Verify note types
Select-String -Path src\screens\SessionScreen.tsx -Pattern "soap|dap|birp"
# Expected: matches for healthcare note type constants

# Sync to iOS (macOS only)
# npm run sync
# npm run ios
```

### Integration Smoke Test

```powershell
# 1. Start ASN backend in stub mode
Set-Location N:\asn\ai-session-notes
$env:AI_ENABLE_STUB_APIS = "1"
pnpm dev

# 2. In another terminal, start mobile dev server pointing at backend
Set-Location N:\legal-notes-mobile
$env:VITE_API_BASE_URL = "http://localhost:3000"
npm run dev

# 3. Open mobile dev URL in browser
# 4. Login -> Record (simulated) -> Verify transcript tab populates -> Verify notes tab populates
# 5. Verify note type selector shows healthcare types
# 6. Verify copy/share works
```

---

## 7. Questions (Critical Details Missing)

| # | Question | Impact | Blocking? |
|---|----------|--------|-----------|
| 1 | **Can the git proxy be authorized for legal-notes-v1?** Remote file listing confirms `SECURITY-AUDIT-2026-02-17.md`, `CONTINUITY.md`, `SESSION_HANDOFF.md`, and agent tooling exist there. However, file contents are unreadable without clone access. Three items (DRY_RUN_CHECKLIST, PRODUCTION_RUNBOOK, TRIAD_OPERATING_MODEL) and Ralph Loop **do not exist in any repo** — they would need to be authored from scratch. | Cannot port security audit, continuity docs, or agent tooling without access | **Yes — for items 15, 15a, 15b** |
| 2 | **Should the mobile app continue as a separate repo, or be merged into ai-session-notes as a monorepo?** This affects the governance doc porting strategy and CI setup. | Determines whether Phase 6 creates new docs or shares existing ones | No — can proceed with separate-repo assumption |
| 3 | **Is Bearer token auth intended for production mobile use, or is it a dev convenience?** The current mobile auth flow bypasses Supabase auth entirely and uses a custom JWT. | Determines security posture of Phase 3 | No — can implement securely either way |
| 4 | **Does the ASN backend's "mediation" note type need to be added, or should the mobile app only use existing healthcare types?** The backend's `ClinicalNoteType` union (`claude.ts:8`) doesn't include "mediation". | Determines if backend change is needed | No — recommend mobile sends healthcare types only |
