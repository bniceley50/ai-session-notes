import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for AI Session Notes E2E tests.
 *
 * Run in stub mode (no real API calls):
 *   $env:AI_ENABLE_STUB_APIS="1"; $env:AI_ENABLE_REAL_APIS="0"; pnpm exec playwright test
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // session state — run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000, // 60s per test — stub pipeline needs time

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 }, // taller to fit all cards
      },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      AI_ENABLE_STUB_APIS: "1",
      AI_ENABLE_REAL_APIS: "0",
      ALLOW_DEV_LOGIN: "1",
    },
  },
});
