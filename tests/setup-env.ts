// tests/setup-env.ts
// Loaded via --import before any test file runs.
// Sets safe defaults so modules that read process.env at import time don't crash.
//
// IMPORTANT: This runs before ANY module is imported, so process.env values set
// here will be picked up by module-level constants like ARTIFACTS_ROOT.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

(process.env as Record<string, string | undefined>).NODE_ENV ??= "test";

// Stub "server-only" — the real package throws unconditionally outside Next.js.
// We create a no-op module in node_modules so CJS require() resolves it.
const serverOnlyDir = path.join(process.cwd(), "node_modules", "server-only");
if (!fs.existsSync(path.join(serverOnlyDir, "index.js")) ||
    fs.readFileSync(path.join(serverOnlyDir, "index.js"), "utf8").includes("throw")) {
  fs.mkdirSync(serverOnlyDir, { recursive: true });
  fs.writeFileSync(path.join(serverOnlyDir, "index.js"), "// no-op stub for tests\n");
  fs.writeFileSync(
    path.join(serverOnlyDir, "package.json"),
    JSON.stringify({ name: "server-only", version: "0.0.1", main: "index.js" }),
  );
}

// Session / JWT
// Use ||= instead of ??= because .env files may set vars to empty strings,
// and our config module's requiredString() rejects empty strings.
process.env.AUTH_COOKIE_SECRET ||= "test-secret-32-bytes-minimum-ok!";
process.env.SESSION_TTL_SECONDS ||= "3600";

// Artifacts root: create a temp dir so tests don't write into the project tree.
// This MUST happen before any module imports artifacts.ts (which captures the value).
if (!process.env.ARTIFACTS_ROOT) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asn-test-"));
  process.env.ARTIFACTS_ROOT = tempRoot;

  // Register cleanup when the process exits
  process.on("exit", () => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
}

// Supabase (dummy values — only needed if supabase client is transitively imported)
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.DEFAULT_PRACTICE_ID ||= "practice-test";

// AI API keys (dummy values — whisper.ts and claude.ts eagerly instantiate clients at import time)
process.env.OPENAI_API_KEY ||= "sk-test-dummy-key";
process.env.ANTHROPIC_API_KEY ||= "sk-ant-test-dummy-key";
