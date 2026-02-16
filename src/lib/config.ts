/**
 * Centralized, typed environment configuration.
 *
 * ── Design decisions ──────────────────────────────────────────
 *  • Non-NEXT_PUBLIC_ variables are automatically stripped from
 *    client bundles by Next.js, so server secrets can never leak.
 *    No "server-only" import is used because test files need to
 *    import this module directly.
 *  • Every variable is read through a typed getter so call-sites
 *    never touch process.env directly.
 *  • Required variables throw at first access if missing; the
 *    error message names the exact var so ops can fix it fast.
 *  • Optional variables return typed defaults.
 *  • `validateConfig()` eagerly checks ALL required vars at once
 *    and throws a single, comprehensive error listing every
 *    missing var.  Call it once at startup (middleware.ts or a
 *    layout server component) and failures surface immediately
 *    in the deploy log rather than on the first unlucky request.
 * ──────────────────────────────────────────────────────────────
 */
// ── Helpers ──────────────────────────────────────────────────

function requiredString(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalString(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function optionalBoolFlag(name: string): boolean {
  const v = process.env[name];
  return v === "1" || v === "true";
}

function optionalPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function requiredPositiveInt(name: string): number {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `Invalid numeric environment variable: ${name} (got "${raw}", expected positive integer)`,
    );
  }
  return Math.floor(n);
}

// ── Supabase ─────────────────────────────────────────────────

/** Public Supabase project URL (also used client-side via NEXT_PUBLIC_ prefix) */
export function supabaseUrl(): string {
  return requiredString("NEXT_PUBLIC_SUPABASE_URL");
}

/** Public Supabase anon key */
export function supabaseAnonKey(): string {
  return requiredString("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Supabase service-role key — optional.
 * Features that need it (ownership sync, notes CRUD) degrade
 * gracefully when absent (filesystem remains source of truth).
 */
export function supabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

// ── Auth ─────────────────────────────────────────────────────

/** Secret used to sign/verify session JWTs. Required. */
export function authCookieSecret(): string {
  return requiredString("AUTH_COOKIE_SECRET");
}

/** How long (seconds) a session cookie is valid. Required. */
export function sessionTtlSeconds(): number {
  return requiredPositiveInt("SESSION_TTL_SECONDS");
}

/** Practice ID injected into dev-login & OAuth callback flows. Required. */
export function defaultPracticeId(): string {
  return requiredString("DEFAULT_PRACTICE_ID");
}

// ── Job lifecycle ────────────────────────────────────────────

/** How long (seconds) before a job is eligible for purge. Default 86 400 (24 h). */
export function jobTtlSeconds(): number {
  return optionalPositiveInt("JOB_TTL_SECONDS", 86_400);
}

/** Filesystem root for job artifacts. Default ".artifacts". */
export function artifactsRoot(): string {
  return optionalString("ARTIFACTS_ROOT", ".artifacts");
}

// ── AI API keys ──────────────────────────────────────────────

/** OpenAI API key (Whisper). Required when real APIs are enabled. */
export function openaiApiKey(): string {
  return requiredString("OPENAI_API_KEY");
}

/** Anthropic API key (Claude). Required when real APIs are enabled. */
export function anthropicApiKey(): string {
  return requiredString("ANTHROPIC_API_KEY");
}

// ── AI API flags ─────────────────────────────────────────────

/** True when real Whisper + Claude calls are enabled. */
export function aiRealApisEnabled(): boolean {
  return optionalBoolFlag("AI_ENABLE_REAL_APIS");
}

/** True when stub/mock API mode is explicitly enabled. */
export function aiStubApisEnabled(): boolean {
  return optionalBoolFlag("AI_ENABLE_STUB_APIS");
}

// ── AI timeouts ──────────────────────────────────────────────

/** Whisper transcription timeout (ms). Default 120 000. */
export function aiWhisperTimeoutMs(): number {
  return optionalPositiveInt("AI_WHISPER_TIMEOUT_MS", 120_000);
}

/** Claude note-generation timeout (ms). Default 90 000. */
export function aiClaudeTimeoutMs(): number {
  return optionalPositiveInt("AI_CLAUDE_TIMEOUT_MS", 90_000);
}

/** Per-chunk Whisper timeout for chunked transcription (ms). Default 120 000. */
export function aiWhisperChunkTimeoutMs(): number {
  return optionalPositiveInt("AI_WHISPER_CHUNK_TIMEOUT_MS", 120_000);
}

// ── Security ─────────────────────────────────────────────────

/** Token required to call the /api/jobs/runner endpoint. */
export function jobsRunnerToken(): string | undefined {
  return process.env.JOBS_RUNNER_TOKEN || undefined;
}

/**
 * Vercel CRON_SECRET — set automatically by Vercel when a cron schedule
 * is configured. Vercel sends it as `Authorization: Bearer <CRON_SECRET>`
 * on every cron invocation. In non-Vercel environments this is unused.
 */
export function cronSecret(): string | undefined {
  return process.env.CRON_SECRET || undefined;
}

// ── Dev-only flags ───────────────────────────────────────────

export function isDevLoginAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    optionalBoolFlag("ALLOW_DEV_LOGIN")
  );
}

export function isSessionAutocreateAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    optionalBoolFlag("ALLOW_SESSION_AUTOCREATE")
  );
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// ── Startup validation ───────────────────────────────────────

/**
 * Check all required env vars at once and throw a single error
 * listing every missing var.  Call early (e.g. in middleware.ts).
 *
 * Variables whose absence is "soft" (service-role key, runner
 * token) are not checked here — they degrade gracefully.
 */
export function validateConfig(): void {
  const missing: string[] = [];

  const required: string[] = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "AUTH_COOKIE_SECRET",
    "SESSION_TTL_SECONDS",
    "DEFAULT_PRACTICE_ID",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
  ];

  for (const name of required) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  // SESSION_TTL_SECONDS must be a valid positive integer
  const ttlRaw = process.env.SESSION_TTL_SECONDS;
  if (ttlRaw) {
    const n = Number(ttlRaw);
    if (!Number.isFinite(n) || n <= 0) {
      missing.push("SESSION_TTL_SECONDS (invalid number)");
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Environment configuration error — missing or invalid:\n  • ${missing.join("\n  • ")}\n\nSee .env.example for required variables.`,
    );
  }
}

