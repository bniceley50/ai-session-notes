import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    ".claude/**",
    ".vibeloop/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
