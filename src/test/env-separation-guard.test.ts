import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { readClientEnv, readServerEnv } from "@/lib/env";
import worker from "@/worker/index";

describe("environment boundary guard", () => {
  it("frontend env parsing must not expose worker service-role secrets", () => {
    const parsed = readClientEnv({
      VITE_APP_NAME: "SBBL HQ",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-should-never-be-client-visible",
    } as unknown as Record<string, unknown>);

    expect("SUPABASE_SERVICE_ROLE_KEY" in parsed).toBe(false);
  });

  it("worker env parsing must not expose VITE_* vars as runtime secrets", () => {
    const parsed = readServerEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-123456789",
      VITE_SUPABASE_ANON_KEY: "client-key-should-not-be-used-by-worker",
    } as unknown as Record<string, unknown>);

    expect("VITE_SUPABASE_ANON_KEY" in parsed).toBe(false);
  });

  it("worker code must not reference import.meta.env VITE_* variables", () => {
    const workerIndex = readFileSync(
      resolve(__dirname, "../worker/index.ts"),
      "utf-8",
    );
    const workerPublicRoutes = readFileSync(
      resolve(__dirname, "../worker/routes/public.ts"),
      "utf-8",
    );
    const combined = `${workerIndex}\n${workerPublicRoutes}`;

    expect(combined).not.toMatch(/import\.meta\.env\./);
    expect(combined).not.toMatch(/\bVITE_[A-Z0-9_]+\b/);
  });

  it("frontend Supabase client must not reference service-role secrets", () => {
    const client = readFileSync(
      resolve(__dirname, "../lib/supabase/client.ts"),
      "utf-8",
    );
    expect(client).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("public-config response surface must not include service-role key fields", () => {
    const workerPublicRoutes = readFileSync(
      resolve(__dirname, "../worker/routes/public.ts"),
      "utf-8",
    );
    expect(workerPublicRoutes).not.toMatch(/supabaseServiceRoleKey/i);
    expect(workerPublicRoutes).not.toMatch(/service_role_key/i);
  });

  it("ops media uploads must be worker-owned (no browser direct storage writes)", () => {
    const opsPage = readFileSync(
      resolve(__dirname, "../pages/Ops.tsx"),
      "utf-8",
    );

    expect(opsPage).not.toMatch(/requireSupabaseClient/);
    expect(opsPage).not.toMatch(/\.storage\.from\(['"]media['"]\)\.upload\(/);
    expect(opsPage).toMatch(/imageUpload:\s*\{/);
  });

  it("worker rejects publishable key masquerading as service-role key", async () => {
    const badEnv = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_1234567890",
      SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_test_key_1234567890",
      STRIPE_SECRET_KEY: "stripe-secret-123456789",
      STRIPE_WEBHOOK_SECRET: "stripe-webhook-123456789",
      RESEND_API_KEY: "resend-key-123456789",
      ASSETS: {
        fetch: (req: Request) =>
          Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)),
      },
    } as unknown as Env;

    const res = await worker.fetch(
      new Request("https://local/ops/health", { method: "GET" }),
      badEnv,
    );
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("supabase_service_key_invalid");
  });
});
