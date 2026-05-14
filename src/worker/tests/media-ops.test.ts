/**
 * Media ops worker contract tests — PR #507 fixes
 *
 * Fix 1: POST /ops/media/bulk-archive returns 409 archive_race_or_validation_failed
 *        when a race condition causes the guarded UPDATE to archive fewer rows
 *        than were validated.
 *
 * Fix 2: DELETE /ops/media/publications/:id returns 409 pinned_items_cannot_be_archived
 *        when the target publication has pinned_at IS NOT NULL.
 *
 * Fix 5: POST /ops/media/publications/:id/pin returns camelCase { id, pinnedAt }
 *        (not snake_case pinned_at) to match the API wrapper type contract.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Queue-based: each from('media_publications') call dequeues the next response.
// Other tables always succeed.

const mpQueue: Array<{ data: unknown; error: unknown }> = [];

function makeSingleChain(resolve: () => Promise<{ data: unknown; error: unknown }>) {
  const chain: Record<string, unknown> = {};
  const noop = (..._: unknown[]) => chain;
  chain.select   = vi.fn(noop);
  chain.eq       = vi.fn(noop);
  chain.in       = vi.fn(noop);
  chain.is       = vi.fn(noop);
  chain.neq      = vi.fn(noop);
  chain.or       = vi.fn(noop);
  chain.limit    = vi.fn(noop);
  chain.order    = vi.fn(noop);
  chain.single   = vi.fn(resolve);
  chain.update   = vi.fn(noop);
  // resolve for non-.single() paths (e.g. .in().is().neq().select('id') awaited directly)
  chain.then     = vi.fn((cb: (v: unknown) => unknown) => Promise.resolve(mpQueue.shift() ?? { data: [], error: null }).then(cb));
  return chain;
}

function makeMediaPublicationsProxy() {
  // Returns a chainable proxy that resolves via mpQueue.
  const next = () => Promise.resolve(mpQueue.shift() ?? { data: null, error: null });
  const chain: Record<string, unknown> = {};
  const noop = (..._: unknown[]) => chain;
  chain.select = vi.fn(noop);
  chain.update = vi.fn(noop);
  chain.eq     = vi.fn(noop);
  chain.in     = vi.fn(noop);
  chain.is     = vi.fn(noop);
  chain.neq    = vi.fn(noop);
  chain.or     = vi.fn(noop);
  chain.limit  = vi.fn(noop);
  chain.order  = vi.fn(noop);
  chain.single = vi.fn(next);
  // thenable — handles awaiting the chain directly (no .single())
  chain.then   = vi.fn((cb: (v: unknown) => unknown) =>
    Promise.resolve(mpQueue.shift() ?? { data: [], error: null }).then(cb)
  );
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u-001" } }, error: null })),
    },
    from: (table: string) => {
      if (table === "user_role_assignments") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn(() => chain);
        chain.eq     = vi.fn(() => chain);
        chain.then   = vi.fn((cb: (v: unknown) => unknown) =>
          Promise.resolve({ data: [{ role: "super_admin" }], error: null }).then(cb)
        );
        return chain;
      }
      if (table === "api_idempotency_keys") {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      if (table === "audit_logs") {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      if (table === "media_publications") {
        return makeMediaPublicationsProxy();
      }
      // Fallback
      const fb: Record<string, unknown> = {};
      const noop = (..._: unknown[]) => fb;
      fb.select = vi.fn(noop); fb.eq = vi.fn(noop); fb.in = vi.fn(noop);
      fb.is = vi.fn(noop); fb.neq = vi.fn(noop); fb.update = vi.fn(noop);
      fb.insert = vi.fn(async () => ({ error: null }));
      fb.single = vi.fn(async () => ({ data: null, error: null }));
      fb.then = vi.fn((cb: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(cb)
      );
      return fb;
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }),
}));

vi.mock("jose", async () => ({
  createRemoteJWKSet: () => () => ({}),
  jwtVerify: vi.fn(async () => ({ payload: { sub: "u-001" } })),
}));

import worker from "@/worker/index";

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_1234567890",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-1234567890123456",
  STRIPE_SECRET_KEY: "stripe-secret-1234567890123456",
  STRIPE_WEBHOOK_SECRET: "stripe-webhook-1234567890123456",
  RESEND_API_KEY: "resend-key-1234567890123456",
  OMNIHUB_SIGNING_SECRET: "shared-omnihub-sbbl-secret-128bit-rotation-q2",
  OMNIHUB_VERIFY_KEY: "shared-omnihub-sbbl-secret-128bit-rotation-q2",
  OMNIHUB_SYNC_URL: "https://hub.example/api/omnibridge/sync",
  ASSETS: {
    fetch: (req: Request) =>
      Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)),
  },
} as unknown as Env;

function authedHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "content-type": "application/json",
    "authorization": "Bearer valid-jwt",
    "x-idempotency-key": crypto.randomUUID(),
    ...extra,
  };
}

beforeEach(() => {
  mpQueue.length = 0;
});

// ── Fix 2: Single-item archive rejects pinned items ───────────────────────────

describe("DELETE /ops/media/publications/:id — server-side pinned guard", () => {
  it("returns 409 pinned_items_cannot_be_archived when pinned_at is set", async () => {
    // Simulate the SELECT that fetches the publication — it's pinned.
    mpQueue.push({ data: { id: "pub-pinned-01", pinned_at: "2026-05-01T00:00:00Z" }, error: null });

    const res = await worker.fetch(
      new Request("https://local/ops/media/publications/pub-pinned-01", {
        method: "DELETE",
        headers: authedHeaders(),
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("pinned_items_cannot_be_archived");
  });

  it("proceeds to archive when pinned_at is null", async () => {
    // SELECT returns unpinned publication.
    mpQueue.push({ data: { id: "pub-free-01", pinned_at: null }, error: null });
    // UPDATE returns archived row.
    mpQueue.push({ data: { id: "pub-free-01", status: "archived" }, error: null });

    const res = await worker.fetch(
      new Request("https://local/ops/media/publications/pub-free-01", {
        method: "DELETE",
        headers: authedHeaders(),
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

// ── Fix 1: Bulk archive 409 on race condition ─────────────────────────────────

describe("POST /ops/media/bulk-archive — all-or-nothing race detection", () => {
  it("returns 409 archive_race_or_validation_failed when UPDATE archives fewer rows than validated", async () => {
    // Validation SELECT returns 2 archivable rows.
    mpQueue.push({
      data: [
        { id: "pub-a", status: "published", pinned_at: null },
        { id: "pub-b", status: "draft",     pinned_at: null },
      ],
      error: null,
    });
    // Guarded UPDATE (with .is('pinned_at',null).neq('status','archived')) returns
    // only 1 row — simulating pub-b was pinned between validation and mutation.
    mpQueue.push({ data: [{ id: "pub-a" }], error: null });

    const res = await worker.fetch(
      new Request("https://local/ops/media/bulk-archive", {
        method: "POST",
        headers: authedHeaders(),
        body: JSON.stringify({ ids: ["pub-a", "pub-b"] }),
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { ok: boolean; error: string; archived: number; expected: number };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("archive_race_or_validation_failed");
    expect(body.archived).toBe(1);
    expect(body.expected).toBe(2);
  });

  it("returns 200 and archived count when all rows update successfully", async () => {
    mpQueue.push({
      data: [
        { id: "pub-c", status: "published", pinned_at: null },
      ],
      error: null,
    });
    mpQueue.push({ data: [{ id: "pub-c" }], error: null });

    const res = await worker.fetch(
      new Request("https://local/ops/media/bulk-archive", {
        method: "POST",
        headers: authedHeaders(),
        body: JSON.stringify({ ids: ["pub-c"] }),
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; archived: number; ids: string[] };
    expect(body.ok).toBe(true);
    expect(body.archived).toBe(1);
    expect(body.ids).toEqual(["pub-c"]);
  });
});

// ── Fix 5: Pin endpoint returns camelCase pinnedAt ────────────────────────────

describe("POST /ops/media/publications/:id/pin — camelCase response contract", () => {
  it("returns { id, pinnedAt } in camelCase, not pinned_at", async () => {
    const pinTs = "2026-05-14T08:00:00.000Z";
    // SELECT returns the updated row with pinned_at.
    mpQueue.push({ data: { id: "pub-pin-01", pinned_at: pinTs }, error: null });

    const res = await worker.fetch(
      new Request("https://local/ops/media/publications/pub-pin-01/pin", {
        method: "POST",
        headers: authedHeaders(),
        body: JSON.stringify({ pin: true }),
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("id", "pub-pin-01");
    expect(body.data).toHaveProperty("pinnedAt", pinTs);
    expect(body.data).not.toHaveProperty("pinned_at");
  });

  it("returns { id, pinnedAt: null } when unpinning", async () => {
    mpQueue.push({ data: { id: "pub-pin-02", pinned_at: null }, error: null });

    const res = await worker.fetch(
      new Request("https://local/ops/media/publications/pub-pin-02/pin", {
        method: "POST",
        headers: authedHeaders(),
        body: JSON.stringify({ pin: false }),
      }),
      BASE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("pinnedAt", null);
    expect(body.data).not.toHaveProperty("pinned_at");
  });
});
