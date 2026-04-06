import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_JWT_REGEX = /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
const LEGACY_PLACEHOLDER_KEY_REGEX = /sb_publishable_/;

/**
 * Guardrail tests for wrangler.jsonc — prevents regressions from careless
 * agents or contributors that rename the worker or remove critical config.
 *
 * CONTEXT:
 * - The live site domains are bound to worker name "sbbl-hq-worker".
 * - A non-Supabase placeholder key format (`sb_publishable_*`) previously
 *   shipped and caused runtime 500s across tab data API calls.
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

  it("must not use legacy sb_publishable placeholder keys", () => {
    expect(raw).not.toMatch(LEGACY_PLACEHOLDER_KEY_REGEX);
  });

  it("must use JWT-formatted SUPABASE_PUBLISHABLE_KEY values", () => {
    expect(raw).toMatch(SUPABASE_JWT_REGEX);
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

  it("must support legacy SUPABASE_URL secret fallback", () => {
    expect(deployYml).toContain("secrets.SUPABASE_URL");
  });

  it("must include fallback for VITE_SUPABASE_ANON_KEY", () => {
    expect(deployYml).toMatch(/VITE_SUPABASE_ANON_KEY:.*\|\|/);
  });

  it("must support legacy SUPABASE_ANON_KEY secret fallback", () => {
    expect(deployYml).toContain("secrets.SUPABASE_ANON_KEY");
  });

  it("must prefer CLOUDFLARE_API_TOKEN_WORKERS with fallback to CLOUDFLARE_API_TOKEN", () => {
    expect(deployYml).toContain(
      "CLOUDFLARE_API_TOKEN_WORKERS || secrets.CLOUDFLARE_API_TOKEN",
    );
  });

  it("must not use legacy sb_publishable placeholder in fallback keys", () => {
    expect(deployYml).not.toMatch(LEGACY_PLACEHOLDER_KEY_REGEX);
  });

  it("must use JWT-formatted fallback key for VITE_SUPABASE_ANON_KEY", () => {
    const fallbackMatch = deployYml.match(/VITE_SUPABASE_ANON_KEY:.*\|\|\s*'([^']+)'/);
    expect(fallbackMatch?.[1]).toBeTruthy();
    expect(fallbackMatch?.[1]).toMatch(SUPABASE_JWT_REGEX);
  });

  it("must parse /ops/health JSON with jq", () => {
    expect(deployYml).toContain("jq -e '.ok == true'");
  });

  it("must include a retry loop for post-deploy health checks", () => {
    expect(deployYml).toContain("for attempt in {1..12}; do");
    expect(deployYml).toContain("sleep 10");
  });
});
