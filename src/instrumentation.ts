/**
 * Next.js Instrumentation Hook
 *
 * Called once when the Next.js server starts (both Node.js and Edge runtimes).
 * We use it to fail-fast on missing environment variables in production
 * so misconfigurations surface in the deploy log — not on the first request.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  // Only validate in production — dev/test environments often have
  // partial .env files and the per-getter errors are sufficient there.
  if (process.env.NODE_ENV === "production") {
    const { validateConfig } = await import("@/lib/config");
    validateConfig();
  }
}
