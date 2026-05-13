/**
 * OmniBridge Worker Integration Tests
 *
 * Exercises the two inbound endpoints SBBL-HQ exposes to APEX-OmniHub plus
 * the hardened outbound sync-packet shape. Runs the production worker in
 * process; mocks only Supabase. No network.
 *
 *   POST /webhooks/omnihub       — HMAC-verified command receiver
 *   POST /api/omniport/command   — JWT-authenticated diagnostic surface
 *   POST /sync/drain             — outbound to OmniHub (envelope shape +
 *                                  X-Omni-Source header + retry/backoff)
 *
 * @license Proprietary - APEX Business Systems Ltd.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture every Supabase mutation so we can assert governance audit trail.
const rpcCalls: Array<{ name: string; args: unknown }> = [];
const insertCalls: Array<{ table: string; row: unknown }> = [];
const updateCalls: Array<{ table: string; patch: unknown }> = [];

const rpc = vi.fn(async (name: string, args: unknown) => {
  rpcCalls.push({ name, args });
  if (name === "claim_outbox_events") {
    return {
      data: [{ id: "outbox-1", event_type: "game.live", entity_type: "game", entity_id: "g-1", league_id: "wbl", payload: { score: 0 }, trace_id: "trace-1" }],
      error: null,
    };
  }
  return { data: null, error: null };
});

// Shared idempotency-key set so the api_idempotency_keys table behaves like
// a real unique-constrained Postgres table across the entire suite. Reset in
// beforeEach so each test starts clean.
const seenIdempotencyKeys = new Set<string>();
const tableProxy = (table: string) => ({
  insert: vi.fn(async (row: { idempotency_key?: string }) => {
    insertCalls.push({ table, row });
    if (table === "api_idempotency_keys") {
      const key = String((row as { idempotency_key?: string }).idempotency_key ?? "");
      if (key && seenIdempotencyKeys.has(key)) {
        return { error: { message: "duplicate key value violates unique constraint api_idempotency_keys_pkey" } };
      }
      if (key) seenIdempotencyKeys.add(key);
    }
    return { error: null };
  }),
  update: vi.fn((patch: unknown) => ({
    eq: vi.fn(async () => { updateCalls.push({ table, patch }); return { error: null }; }),
  })),
  select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })), eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-test-001" } }, error: null })) },
    rpc,
    from: (table: string) => tableProxy(table),
  }),
}));

// Force ensureMutation/idempotency to no-op for these tests by stubbing the
// JWT verifier so requireAuth path goes through.
vi.mock("jose", async () => {
  return {
    createRemoteJWKSet: () => () => ({}),
    jwtVerify: vi.fn(async () => ({ payload: { sub: "user-test-001", user_role: "admin" } })),
  };
});

import worker from "@/worker/index";

const baseEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_1234567890",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-1234567890123456",
  STRIPE_SECRET_KEY: "stripe-secret-1234567890123456",
  STRIPE_WEBHOOK_SECRET: "stripe-webhook-1234567890123456",
  RESEND_API_KEY: "resend-key-1234567890123456",
  OMNIHUB_SIGNING_SECRET: "shared-omnihub-sbbl-secret-128bit-rotation-q2",
  OMNIHUB_VERIFY_KEY: "shared-omnihub-sbbl-secret-128bit-rotation-q2",
  OMNIHUB_SYNC_URL: "https://hub.example/api/omnibridge/sync",
  ASSETS: { fetch: (req: Request) => Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)) },
} as unknown as Env;

const encoder = new TextEncoder();
function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCodePoint(b); });
  // btoa exists in vitest/jsdom environment by default; this matches the worker primitive.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function signCommand(command: Record<string, unknown>, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(command)));
  return base64UrlEncode(sig);
}

function buildCommand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    command_id: crypto.randomUUID(),
    action: "ping",
    target_source: "sbbl-hq",
    target_entity_id: null,
    reason: "integration-test",
    issued_at: new Date().toISOString(),
    issued_by: "omnihub-bot",
    payload: { },
    ...overrides,
  };
}

beforeEach(() => {
  rpcCalls.length = 0;
  insertCalls.length = 0;
  updateCalls.length = 0;
  seenIdempotencyKeys.clear();
  rpc.mockClear();
});

describe("POST /webhooks/omnihub — inbound governance channel", () => {
  it("rejects missing X-Omni-Command-Id header", async () => {
    const cmd = buildCommand();
    const sig = await signCommand(cmd, baseEnv.OMNIHUB_VERIFY_KEY as string);
    const res = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Signature": sig },
      body: JSON.stringify({ command: cmd, signature: sig }),
    }), baseEnv);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("missing_headers");
  });

  it("rejects bad signatures", async () => {
    const cmd = buildCommand();
    const res = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Command-Id": cmd.command_id as string, "X-Omni-Signature": "AAAA-tampered-AAAA" },
      body: JSON.stringify({ command: cmd, signature: "AAAA-tampered-AAAA" }),
    }), baseEnv);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("bad_signature");
  });

  it("rejects target_source mismatch", async () => {
    const cmd = buildCommand({ target_source: "another-app" });
    const sig = await signCommand(cmd, baseEnv.OMNIHUB_VERIFY_KEY as string);
    const res = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Command-Id": cmd.command_id as string, "X-Omni-Signature": sig },
      body: JSON.stringify({ command: cmd, signature: sig }),
    }), baseEnv);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("target_source_mismatch");
  });

  it("rejects stale commands (>5min skew)", async () => {
    const cmd = buildCommand({ issued_at: new Date(Date.now() - 10 * 60_000).toISOString() });
    const sig = await signCommand(cmd, baseEnv.OMNIHUB_VERIFY_KEY as string);
    const res = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Command-Id": cmd.command_id as string, "X-Omni-Signature": sig },
      body: JSON.stringify({ command: cmd, signature: sig }),
    }), baseEnv);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("stale_command");
  });

  it("accepts valid ping command and writes governance audit row", async () => {
    const cmd = buildCommand({ action: "ping" });
    const sig = await signCommand(cmd, baseEnv.OMNIHUB_VERIFY_KEY as string);
    const res = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Command-Id": cmd.command_id as string, "X-Omni-Signature": sig },
      body: JSON.stringify({ command: cmd, signature: sig }),
    }), baseEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; command_id: string; risk_lane: string; result: { ack: boolean } };
    expect(body.ok).toBe(true);
    expect(body.command_id).toBe(cmd.command_id);
    expect(body.risk_lane).toBe("GREEN");
    expect(body.result.ack).toBe(true);

    // Idempotency row was inserted into api_idempotency_keys.
    expect(insertCalls.some((c) => c.table === "api_idempotency_keys")).toBe(true);
    // Governance audit row was written.
    expect(rpcCalls.some((c) => c.name === "log_admin_action")).toBe(true);
  });

  it("blocks DROP TABLE payloads even when signed", async () => {
    const cmd = buildCommand({ action: "broadcast_message", payload: { sql: "DROP TABLE players" } });
    const sig = await signCommand(cmd, baseEnv.OMNIHUB_VERIFY_KEY as string);
    const res = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Command-Id": cmd.command_id as string, "X-Omni-Signature": sig },
      body: JSON.stringify({ command: cmd, signature: sig }),
    }), baseEnv);
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; risk_lane: string };
    expect(body.error).toBe("blocked");
    expect(body.risk_lane).toBe("BLOCKED");
    expect(rpcCalls.some((c) => c.name === "record_ingress_failure")).toBe(true);
  });

  it("dedupes replayed commands via idempotency_key", async () => {
    const cmd = buildCommand({ action: "ping" });
    const sig = await signCommand(cmd, baseEnv.OMNIHUB_VERIFY_KEY as string);
    // First request — insert succeeds.
    const first = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Command-Id": cmd.command_id as string, "X-Omni-Signature": sig },
      body: JSON.stringify({ command: cmd, signature: sig }),
    }), baseEnv);
    expect(first.status).toBe(200);
    const firstBody = await first.json() as { duplicate?: boolean };
    expect(firstBody.duplicate).toBeUndefined();

    // Same command_id replayed — duplicate detected.
    const second = await worker.fetch(new Request("https://local/webhooks/omnihub", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Omni-Command-Id": cmd.command_id as string, "X-Omni-Signature": sig },
      body: JSON.stringify({ command: cmd, signature: sig }),
    }), baseEnv);
    expect(second.status).toBe(200);
    const secondBody = await second.json() as { duplicate?: boolean };
    expect(secondBody.duplicate).toBe(true);
  });
});

describe("POST /api/omniport/command — authenticated diagnostic surface", () => {
  it("rejects unauthenticated callers with 401", async () => {
    const res = await worker.fetch(new Request("https://local/api/omniport/command", {
      method: "POST",
      headers: { "content-type": "application/json", "x-idempotency-key": "test-anon-call-001" },
      body: JSON.stringify({ command: "PING", targetApp: "sbbl-hq" }),
    }), baseEnv);
    expect(res.status).toBe(401);
  });

  it("accepts PING with a Bearer token", async () => {
    const res = await worker.fetch(new Request("https://local/api/omniport/command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "test-ping-key-001",
        authorization: "Bearer valid-jwt",
      },
      body: JSON.stringify({ command: "PING", targetApp: "sbbl-hq", data: { ts: Date.now() } }),
    }), baseEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; command: string; pong_at: string };
    expect(body.success).toBe(true);
    expect(body.command).toBe("PING");
    expect(body.pong_at).toBeTruthy();
  });

  it("rejects unsupported commands with 400", async () => {
    const res = await worker.fetch(new Request("https://local/api/omniport/command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "test-bad-cmd-key-001",
        authorization: "Bearer valid-jwt",
      },
      body: JSON.stringify({ command: "__INVALID__", targetApp: "sbbl-hq" }),
    }), baseEnv);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("unsupported_command");
  });

  it("HEALTH_CHECK surfaces dependency configuration", async () => {
    const res = await worker.fetch(new Request("https://local/api/omniport/command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "test-health-key-001",
        authorization: "Bearer valid-jwt",
      },
      body: JSON.stringify({ command: "HEALTH_CHECK", targetApp: "sbbl-hq" }),
    }), baseEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; checks: { worker: string; supabase: string; omnihub_sync: string } };
    expect(body.success).toBe(true);
    expect(body.checks.worker).toBe("ok");
    expect(body.checks.supabase).toBe("configured");
    expect(body.checks.omnihub_sync).toBe("configured");
  });
});

describe("POST /sync/drain — outbound envelope shape + headers", () => {
  it("delivers { packet, signature } envelope with X-Omni-Source header", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: input.toString(), init: init ?? {} });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const res = await worker.fetch(new Request("https://local/sync/drain", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "drain-envelope-001",
        authorization: "Bearer valid-jwt",
      },
    }), baseEnv);
    expect(res.status).toBe(200);
    expect(captured.length).toBe(1);

    const headers = new Headers(captured[0].init.headers);
    expect(headers.get("X-Omni-Source")).toBe("sbbl-hq");
    expect(headers.get("X-Omni-Signature")).toBeTruthy();
    expect(headers.get("X-Omni-Packet-Id")).toBeTruthy();
    expect(headers.get("X-Omni-Trace-Id")).toBeTruthy();

    const body = JSON.parse(captured[0].init.body as string);
    expect(body.packet).toBeTruthy();
    expect(body.signature).toBeTruthy();
    expect(body.packet.event_type).toBe("game.live");
    expect(body.packet.entity_id).toBe("g-1");
    expect(typeof body.packet.emitted_at).toBe("string");
  });

  it("retries 5xx responses with backoff (and surfaces final result)", async () => {
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      if (calls < 3) return new Response("upstream down", { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;

    const res = await worker.fetch(new Request("https://local/sync/drain?limit=1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "drain-retry-001",
        authorization: "Bearer valid-jwt",
      },
    }), baseEnv);
    expect(res.status).toBe(200);
    expect(calls).toBeGreaterThanOrEqual(3);
  }, 15_000);

  it("stops on 4xx (target_rejected) without retrying", async () => {
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      return new Response("rejected", { status: 401 });
    }) as unknown as typeof fetch;

    const res = await worker.fetch(new Request("https://local/sync/drain?limit=1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "drain-4xx-001",
        authorization: "Bearer valid-jwt",
      },
    }), baseEnv);
    expect(res.status).toBe(200);
    expect(calls).toBe(1); // no retry on 4xx
    expect(rpcCalls.some((c) => c.name === "mark_outbox_retry")).toBe(true);
  });
});
