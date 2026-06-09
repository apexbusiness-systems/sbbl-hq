import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

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

  it("must define cloud Supabase URL in vars", () => {
    // Must point to the cloud Supabase project — not the retired self-hosted instance.
    expect(raw).toContain('"SUPABASE_URL": "https://ezanilxygnpucwkwpsoc.supabase.co"');
    expect(raw).not.toContain('supabase.sbbl-hq.icu');
  });

  it("must define SUPABASE_PUBLISHABLE_KEY in vars", () => {
    expect(raw).toMatch(/"SUPABASE_PUBLISHABLE_KEY":\s*"[^"]+"/);
  });

  it("must not use legacy sb_publishable placeholder keys", () => {
    expect(raw).not.toMatch(LEGACY_PLACEHOLDER_KEY_REGEX);
  });

  it("must not commit hosted Supabase JWT fallback keys", () => {
    expect(raw).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
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

  it("must read VITE_SUPABASE_URL from secrets (supports cloud and self-hosted)", () => {
    // Supports both cloud (*.supabase.co) and future self-hosted via the same secret.
    expect(deployYml).toContain('secrets.VITE_SUPABASE_URL || secrets.SUPABASE_URL');
    // Must not hardcode the retired self-hosted endpoint.
    expect(deployYml).not.toContain('supabase.sbbl-hq.icu');
  });

  it("must support legacy SUPABASE_URL secret fallback", () => {
    expect(deployYml).toContain("secrets.SUPABASE_URL");
  });

  it("must read VITE_SUPABASE_ANON_KEY from explicit public key secrets only", () => {
    expect(deployYml).toContain('secrets.VITE_SUPABASE_ANON_KEY || secrets.SUPABASE_ANON_KEY');
  });

  it("must not use legacy sb_publishable placeholder in fallback keys", () => {
    expect(deployYml).not.toMatch(LEGACY_PLACEHOLDER_KEY_REGEX);
  });

  it("must not commit VITE_SUPABASE_ANON_KEY fallback literals", () => {
    expect(deployYml).not.toMatch(/VITE_SUPABASE_ANON_KEY:.*\|\|\s*'[^']+'/);
  });

  it("must parse /ops/health JSON with jq and gate on both ok + db_ok", () => {
    // We require the predicate to check both `.ok` (worker up) AND
    // `.db_ok` (worker can reach Supabase). A worker with a broken DB
    // connection must never mark a deploy healthy.
    expect(deployYml).toContain("jq -e '.ok == true and .db_ok == true'");
  });

  it("must include a retry loop for post-deploy health checks", () => {
    expect(deployYml).toContain("for attempt in {1..8}; do");
    expect(deployYml).toContain("sleep 15");
  });
});
