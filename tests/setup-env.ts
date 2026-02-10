// tests/setup-env.ts
// Loaded via --import before any test file runs.
// Sets safe defaults so modules that read process.env at import time don't crash.
//
// IMPORTANT: This runs before ANY module is imported, so process.env values set
// here will be picked up by module-level constants like ARTIFACTS_ROOT.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV ??= "test";

// Session / JWT
process.env.AUTH_COOKIE_SECRET ??= "test-secret-32-bytes-minimum-ok!";
process.env.SESSION_TTL_SECONDS ??= "3600";

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

// Cognito (dummy values — only needed if auth/config.ts is transitively imported)
process.env.COGNITO_DOMAIN ??= "example.auth.us-east-1.amazoncognito.com";
process.env.COGNITO_CLIENT_ID ??= "dummy-client-id";
process.env.COGNITO_CLIENT_SECRET ??= "dummy-client-secret";
process.env.COGNITO_REDIRECT_URI ??= "http://localhost:3000/api/auth/callback";
process.env.COGNITO_LOGOUT_URI ??= "http://localhost:3000/";
process.env.COGNITO_USER_POOL_ID ??= "us-east-1_dummy";
process.env.COGNITO_REGION ??= "us-east-1";
process.env.DEFAULT_PRACTICE_ID ??= "practice-test";
