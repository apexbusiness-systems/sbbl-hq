import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Guardrail tests for wrangler.jsonc — prevents regressions from careless
 * agents or contributors that rename the worker or remove critical config.
 *
 * CONTEXT: The worker name "sbbl-hq" has Cloudflare secrets bound to it
 * (SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, etc.). Renaming the worker
 * deploys a NEW Cloudflare Worker with ZERO secrets, causing "Invalid API key"
 * errors on every API route. This happened in commit d7064b4 when the name
 * was changed to "sbbl-hq-worker", breaking Scores, Teams, and all data tabs.
 */
describe("wrangler.jsonc guardrails", () => {
  const raw = readFileSync(
    resolve(__dirname, "../../wrangler.jsonc"),
    "utf-8",
  );

  it('worker name MUST be "sbbl-hq-worker" (custom domains + secrets are bound to this name)', () => {
    expect(raw).toMatch(/"name":\s*"sbbl-hq-worker"/);
  });

  it("must define SUPABASE_URL in vars", () => {
    expect(raw).toMatch(/"SUPABASE_URL":\s*"https:\/\/.*supabase\.co"/);
  });

  it("must define SUPABASE_PUBLISHABLE_KEY in vars", () => {
    expect(raw).toMatch(/"SUPABASE_PUBLISHABLE_KEY":\s*"[^"]+"/);
  });

  it("must have custom_domain routes for sbbl-hq.icu", () => {
    expect(raw).toContain('"sbbl-hq.icu"');
  });

  it("must include nodejs_compat flag", () => {
    expect(raw).toContain("nodejs_compat");
  });
});

describe("deploy.yml guardrails", () => {
  const deployYml = readFileSync(
    resolve(__dirname, "../../.github/workflows/deploy.yml"),
    "utf-8",
  );

  it("must include VITE_APP_NAME in build env", () => {
    expect(deployYml).toContain("VITE_APP_NAME");
  });

  it("must include VITE_DEFAULT_LEAGUE in build env", () => {
    expect(deployYml).toContain("VITE_DEFAULT_LEAGUE");
  });

  it("must include fallback for VITE_SUPABASE_URL", () => {
    expect(deployYml).toMatch(/VITE_SUPABASE_URL:.*\|\|/);
  });

  it("must include fallback for VITE_SUPABASE_ANON_KEY", () => {
    expect(deployYml).toMatch(/VITE_SUPABASE_ANON_KEY:.*\|\|/);
  });
});
