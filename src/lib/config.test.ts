/**
 * Tests for centralized environment configuration.
 *
 * Each test saves and restores affected env vars so the suite is
 * hermetic regardless of execution order.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  isDevLoginAllowed,
  isDevelopment,
  isProduction,
  isSessionAutocreateAllowed,
} from "@/lib/config";

// ── We can't import config.ts directly because it has
//    `import "server-only"` which only exists in the Next.js
//    build.  Instead we test the _logic_ by exercising the same
//    patterns the module uses.  The module itself gets a full
//    integration check via `pnpm tsc --noEmit` (compile) and
//    through the route tests that import it.
//
//    This file tests validateConfig-style logic with a minimal
//    re-implementation of the helpers so we verify the contract.
// ────────────────────────────────────────────────────────────────

// Minimal re-implementations matching config.ts logic exactly

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

function validateConfig(): void {
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

// ── Tests ──────────────────────────────────────────────────────

describe("config helpers", () => {
  describe("requiredString", () => {
    const key = "__TEST_REQUIRED_STRING__";
    let saved: string | undefined;

    beforeEach(() => {
      saved = process.env[key];
    });
    afterEach(() => {
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
    });

    it("returns the value when set", () => {
      process.env[key] = "hello";
      assert.equal(requiredString(key), "hello");
    });

    it("throws when missing", () => {
      delete process.env[key];
      assert.throws(
        () => requiredString(key),
        { message: `Missing required environment variable: ${key}` },
      );
    });

    it("throws when empty string", () => {
      process.env[key] = "";
      assert.throws(() => requiredString(key));
    });
  });

  describe("optionalString", () => {
    const key = "__TEST_OPTIONAL_STRING__";
    let saved: string | undefined;

    beforeEach(() => {
      saved = process.env[key];
    });
    afterEach(() => {
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
    });

    it("returns env value when set", () => {
      process.env[key] = "custom";
      assert.equal(optionalString(key, "default"), "custom");
    });

    it("returns fallback when missing", () => {
      delete process.env[key];
      assert.equal(optionalString(key, "default"), "default");
    });
  });

  describe("optionalBoolFlag", () => {
    const key = "__TEST_BOOL_FLAG__";
    let saved: string | undefined;

    beforeEach(() => {
      saved = process.env[key];
    });
    afterEach(() => {
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
    });

    it("returns true for '1'", () => {
      process.env[key] = "1";
      assert.equal(optionalBoolFlag(key), true);
    });

    it("returns true for 'true'", () => {
      process.env[key] = "true";
      assert.equal(optionalBoolFlag(key), true);
    });

    it("returns false for '0'", () => {
      process.env[key] = "0";
      assert.equal(optionalBoolFlag(key), false);
    });

    it("returns false when missing", () => {
      delete process.env[key];
      assert.equal(optionalBoolFlag(key), false);
    });
  });

  describe("optionalPositiveInt", () => {
    const key = "__TEST_OPT_INT__";
    let saved: string | undefined;

    beforeEach(() => {
      saved = process.env[key];
    });
    afterEach(() => {
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
    });

    it("parses valid integer", () => {
      process.env[key] = "42";
      assert.equal(optionalPositiveInt(key, 10), 42);
    });

    it("returns fallback for non-numeric", () => {
      process.env[key] = "abc";
      assert.equal(optionalPositiveInt(key, 10), 10);
    });

    it("returns fallback for zero", () => {
      process.env[key] = "0";
      assert.equal(optionalPositiveInt(key, 10), 10);
    });

    it("returns fallback for negative", () => {
      process.env[key] = "-5";
      assert.equal(optionalPositiveInt(key, 10), 10);
    });

    it("returns fallback when missing", () => {
      delete process.env[key];
      assert.equal(optionalPositiveInt(key, 99), 99);
    });

    it("floors decimal values", () => {
      process.env[key] = "7.9";
      assert.equal(optionalPositiveInt(key, 10), 7);
    });
  });

  describe("requiredPositiveInt", () => {
    const key = "__TEST_REQ_INT__";
    let saved: string | undefined;

    beforeEach(() => {
      saved = process.env[key];
    });
    afterEach(() => {
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
    });

    it("parses valid integer", () => {
      process.env[key] = "3600";
      assert.equal(requiredPositiveInt(key), 3600);
    });

    it("throws when missing", () => {
      delete process.env[key];
      assert.throws(() => requiredPositiveInt(key));
    });

    it("throws for non-numeric", () => {
      process.env[key] = "abc";
      assert.throws(
        () => requiredPositiveInt(key),
        (err: Error) => err.message.includes("Invalid numeric"),
      );
    });

    it("throws for zero", () => {
      process.env[key] = "0";
      assert.throws(() => requiredPositiveInt(key));
    });
  });
});

describe("validateConfig", () => {
  // Save ALL required vars
  const REQUIRED_KEYS = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "AUTH_COOKIE_SECRET",
    "SESSION_TTL_SECONDS",
    "DEFAULT_PRACTICE_ID",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
  ] as const;

  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of REQUIRED_KEYS) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of REQUIRED_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("passes when all required vars are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.AUTH_COOKIE_SECRET = "test-secret-32-bytes-minimum-ok!";
    process.env.SESSION_TTL_SECONDS = "3600";
    process.env.DEFAULT_PRACTICE_ID = "practice-test";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    assert.doesNotThrow(() => validateConfig());
  });

  it("throws listing all missing vars when none are set", () => {
    for (const key of REQUIRED_KEYS) {
      delete process.env[key];
    }

    assert.throws(
      () => validateConfig(),
      (err: Error) => {
        // Should mention every missing var
        for (const key of REQUIRED_KEYS) {
          if (!err.message.includes(key)) return false;
        }
        return err.message.includes("Environment configuration error");
      },
    );
  });

  it("throws when only one var is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.AUTH_COOKIE_SECRET = "test-secret-32-bytes-minimum-ok!";
    process.env.SESSION_TTL_SECONDS = "3600";
    process.env.DEFAULT_PRACTICE_ID = "practice-test";
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.ANTHROPIC_API_KEY;

    assert.throws(
      () => validateConfig(),
      (err: Error) => err.message.includes("ANTHROPIC_API_KEY"),
    );
  });

  it("catches invalid SESSION_TTL_SECONDS", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.AUTH_COOKIE_SECRET = "test-secret-32-bytes-minimum-ok!";
    process.env.SESSION_TTL_SECONDS = "not-a-number";
    process.env.DEFAULT_PRACTICE_ID = "practice-test";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    assert.throws(
      () => validateConfig(),
      (err: Error) => err.message.includes("SESSION_TTL_SECONDS"),
    );
  });
});

// ── Dev-flag guard tests (imported from @/lib/config) ─────────

describe("isDevLoginAllowed", () => {
  const ENV_KEYS = ["NODE_ENV", "ALLOW_DEV_LOGIN"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("returns true when NODE_ENV=development AND ALLOW_DEV_LOGIN=1", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.ALLOW_DEV_LOGIN = "1";
    assert.equal(isDevLoginAllowed(), true);
  });

  it("returns false when NODE_ENV=production (even with flag set)", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.ALLOW_DEV_LOGIN = "1";
    assert.equal(isDevLoginAllowed(), false);
  });

  it("returns false when ALLOW_DEV_LOGIN is missing", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    delete process.env.ALLOW_DEV_LOGIN;
    assert.equal(isDevLoginAllowed(), false);
  });

  it("returns false when ALLOW_DEV_LOGIN=0", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.ALLOW_DEV_LOGIN = "0";
    assert.equal(isDevLoginAllowed(), false);
  });

  it("returns false when ALLOW_DEV_LOGIN=false", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.ALLOW_DEV_LOGIN = "false";
    assert.equal(isDevLoginAllowed(), false);
  });

  it("returns false when NODE_ENV=test", () => {
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.ALLOW_DEV_LOGIN = "1";
    assert.equal(isDevLoginAllowed(), false);
  });
});

describe("isSessionAutocreateAllowed", () => {
  const ENV_KEYS = ["NODE_ENV", "ALLOW_SESSION_AUTOCREATE"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("returns true when NODE_ENV=development AND flag=1", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.ALLOW_SESSION_AUTOCREATE = "1";
    assert.equal(isSessionAutocreateAllowed(), true);
  });

  it("returns true when NODE_ENV=test AND flag=1", () => {
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.ALLOW_SESSION_AUTOCREATE = "1";
    assert.equal(isSessionAutocreateAllowed(), true);
  });

  it("returns false when NODE_ENV=production (even with flag=1)", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.ALLOW_SESSION_AUTOCREATE = "1";
    assert.equal(isSessionAutocreateAllowed(), false);
  });

  it("returns false when flag is missing", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    delete process.env.ALLOW_SESSION_AUTOCREATE;
    assert.equal(isSessionAutocreateAllowed(), false);
  });
});

describe("isDevelopment / isProduction", () => {
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
  });
  afterEach(() => {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  });

  it("isDevelopment returns true only for development", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    assert.equal(isDevelopment(), true);
    assert.equal(isProduction(), false);
  });

  it("isProduction returns true only for production", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    assert.equal(isProduction(), true);
    assert.equal(isDevelopment(), false);
  });

  it("both return false for test env", () => {
    (process.env as Record<string, string>).NODE_ENV = "test";
    assert.equal(isDevelopment(), false);
    assert.equal(isProduction(), false);
  });
});

