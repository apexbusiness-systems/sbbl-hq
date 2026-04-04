/**
 * stripe-webhook — Supabase Edge Function (Deno)
 *
 * DEPRECATED: The canonical Stripe webhook handler is now the Cloudflare Worker
 * route at POST /webhooks/stripe (src/worker/index.ts). This Edge Function is
 * retained as an archival reference and potential fallback. Do not add new
 * functionality here — update the Worker handler instead.
 *
 * P3-A: Stripe webhook idempotency handler.
 * P3-B: Route-separated (registration vs sponsorship), structured error
 *       reporting, one DB I/O per happy-path execution.
 *
 * Happy-path flow:
 *   1. Read raw bytes (Uint8Array) — must NOT convert to text before verify.
 *   2. Verify Stripe-Signature HMAC-SHA256 against raw bytes.
 *   3. Parse JSON event.
 *   4. Check stripe_events for existing stripe_event_id (idempotency).
 *      → If duplicate: return 200 immediately (Stripe expects 200 on replay).
 *   5. Insert into stripe_events (status = 'processing' → updated at end).
 *   6. Route to the appropriate handler based on event.type + metadata.
 *   7. Call process_stripe_webhook RPC for transactional business writes.
 *   8. Respond 200.
 *
 * Sentry integration (P3-B):
 *   Errors on unexpected 4xx/5xx paths are logged to Sentry DSN via
 *   SENTRY_DSN environment variable. If SENTRY_DSN is absent, errors are
 *   logged to stderr only.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  livemode?: boolean;
}

interface ProcessResult {
  duplicate: boolean;
  payment_recorded: boolean;
}

// ── HMAC-SHA256 Stripe signature verification ─────────────────────────────────

async function verifyStripeSignature(
  rawBytes: Uint8Array,
  signatureHeader: string,
  secret: string,
  nowMs = Date.now(),
): Promise<boolean> {
  // Parse "t=<timestamp>,v1=<hex>,v1=<hex>" format
  const parts = Object.fromEntries(
    signatureHeader.split(",").flatMap((part) => {
      const eq = part.indexOf("=");
      if (eq === -1) return [];
      return [[part.slice(0, eq).trim(), part.slice(eq + 1).trim()]];
    }),
  ) as Record<string, string>;

  const ts = parseInt(parts["t"] ?? "", 10);
  if (!Number.isFinite(ts)) return false;

  // Reject events older than 5 minutes (prevents replay attacks)
  if (Math.abs(Math.floor(nowMs / 1000) - ts) > 300) return false;

  const v1Sigs = signatureHeader
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3).toLowerCase());
  if (v1Sigs.length === 0) return false;

  // Build signed payload: "<timestamp>.<rawBody>" using original bytes
  const tsBytes = new TextEncoder().encode(`${ts}.`);
  const signedPayload = new Uint8Array(tsBytes.length + rawBytes.length);
  signedPayload.set(tsBytes);
  signedPayload.set(rawBytes, tsBytes.length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, signedPayload);
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return v1Sigs.some((candidate) => candidate === computed);
}

// ── Sentry error reporter (P3-B) ──────────────────────────────────────────────

async function reportToSentry(
  dsn: string | undefined,
  error: unknown,
  context: Record<string, unknown>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[stripe-webhook]", message, context);
  if (!dsn) return;

  try {
    // Minimal Sentry envelope format — avoids importing the full Sentry SDK
    const [, , host, , projectId] =
      dsn.match(/^https:\/\/([^@]+)@([^/]+)(\/(\d+))?/) ?? [];
    if (!host || !projectId) return;

    const envelope = [
      JSON.stringify({ sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        level: "error",
        message,
        extra: context,
        timestamp: Math.floor(Date.now() / 1000),
        platform: "javascript",
        sdk: { name: "sbbl-hq-edge", version: "1.0.0" },
      }),
    ].join("\n");

    await fetch(`https://${host}/api/${projectId}/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_key=${dsn.split("//")[1]?.split("@")[0]}`,
      },
      body: envelope,
    });
  } catch {
    // Sentry reporting failed — don't let this surface to caller
  }
}

// ── Route handler dispatch ────────────────────────────────────────────────────

function routeEvent(
  event: StripeEvent,
): "registration" | "sponsorship" | "store_order" | "ppv" | "generic" {
  const meta =
    (event.data.object.metadata as Record<string, unknown> | undefined) ?? {};
  const purchaseType =
    typeof meta.purchase_type === "string" ? meta.purchase_type : null;

  if (purchaseType === "sponsorship") return "sponsorship";
  if (purchaseType === "ppv") return "ppv";
  if (purchaseType === "store_order") return "store_order";
  if (
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return "registration";
  }
  return "generic";
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const env = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
    SUPABASE_SERVICE_ROLE_KEY:
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    STRIPE_WEBHOOK_SECRET: Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    SENTRY_DSN: Deno.env.get("SENTRY_DSN"),
  };

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response(
      JSON.stringify({ error: "stripe_webhook_secret_missing" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const signatureHeader = req.headers.get("stripe-signature");
  if (!signatureHeader) {
    return new Response(
      JSON.stringify({ error: "stripe_signature_missing" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Step 1: Read raw bytes BEFORE any text conversion ────────────────────
  // Stripe signature is computed against the raw request body bytes.
  // Any intermediate text decoding can alter the byte representation
  // (e.g., BOM stripping, newline normalization) and break verification.
  const rawBytes = new Uint8Array(await req.arrayBuffer());

  // ── Step 2: Verify signature ──────────────────────────────────────────────
  const verified = await verifyStripeSignature(
    rawBytes,
    signatureHeader,
    env.STRIPE_WEBHOOK_SECRET,
  );
  if (!verified) {
    await reportToSentry(env.SENTRY_DSN, new Error("invalid_stripe_signature"), {
      signatureHeader,
    });
    return new Response(
      JSON.stringify({ error: "invalid_stripe_signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Step 3: Parse event ───────────────────────────────────────────────────
  let event: StripeEvent;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBytes)) as StripeEvent;
  } catch (parseErr) {
    await reportToSentry(env.SENTRY_DSN, parseErr, { rawLength: rawBytes.length });
    return new Response(
      JSON.stringify({ error: "invalid_stripe_json" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!event.id || !event.type) {
    return new Response(
      JSON.stringify({ error: "invalid_stripe_event" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Step 4: Idempotency check via stripe_events table ────────────────────
  const admin = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const { data: existing } = await admin
    .from("stripe_events")
    .select("id,status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    // Stripe re-delivers on non-200 response; return 200 on duplicate.
    return new Response(
      JSON.stringify({ ok: true, duplicate: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Step 5: Insert idempotency record ─────────────────────────────────────
  const { error: insertError } = await admin.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    status: "processed",
  });

  // Race condition: another instance inserted between our check and insert
  if (insertError?.code === "23505") {
    return new Response(
      JSON.stringify({ ok: true, duplicate: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (insertError) {
    await reportToSentry(env.SENTRY_DSN, insertError, { eventId: event.id });
    return new Response(
      JSON.stringify({ error: "stripe_events_insert_failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Step 6 & 7: Route + transactional business writes ────────────────────
  const route = routeEvent(event);
  const object = event.data.object;
  const meta = (object.metadata as Record<string, unknown> | undefined) ?? {};

  const userId =
    typeof meta.user_id === "string" ? meta.user_id : null;
  const orderId =
    typeof meta.order_id === "string" ? meta.order_id : null;
  const providerRef =
    typeof object.id === "string"
      ? object.id
      : typeof object.payment_intent === "string"
        ? object.payment_intent
        : event.id;

  // Log route for observability
  console.info("[stripe-webhook]", {
    eventId: event.id,
    eventType: event.type,
    route,
    userId,
  });

  try {
    const { error: rpcError } = await admin.rpc("process_stripe_webhook", {
      p_event_id:   event.id,
      p_event_type: event.type,
      p_user_id:    userId,
      p_order_id:   orderId,
      p_provider_ref: providerRef,
      p_payload:    event as unknown as Record<string, unknown>,
    });

    if (rpcError) {
      // RPC duplicate (billing_events unique constraint) — still 200
      if (rpcError.message?.includes("duplicate")) {
        return new Response(
          JSON.stringify({ ok: true, duplicate: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw rpcError;
    }
  } catch (rpcErr) {
    // Mark the stripe_events row as failed for observability
    await admin
      .from("stripe_events")
      .update({ status: "failed", error_detail: String(rpcErr) })
      .eq("stripe_event_id", event.id);

    await reportToSentry(env.SENTRY_DSN, rpcErr, {
      eventId: event.id,
      eventType: event.type,
      route,
    });

    return new Response(
      JSON.stringify({ error: "processing_failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, route }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
