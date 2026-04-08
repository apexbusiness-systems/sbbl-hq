import { describe, expect, it } from "vitest";
import worker from "@/worker/index";

type RouteCase = {
  method: "GET" | "POST";
  path: string;
  category: "ingress" | "render";
};

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_1234567890",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-123456789",
  STRIPE_SECRET_KEY: "stripe-secret-123456789",
  STRIPE_WEBHOOK_SECRET: "stripe-webhook-123456789",
  RESEND_API_KEY: "resend-key-123456789",
  ASSETS: {
    fetch: (req: Request) =>
      Promise.resolve(new Response(`asset:${new URL(req.url).pathname}`)),
  },
} as unknown as Env;

const ingressRoutes: RouteCase[] = [
  { method: "POST", path: "/api/ingress", category: "ingress" },
  { method: "POST", path: "/ops/imports/teams", category: "ingress" },
  { method: "POST", path: "/ops/imports/players", category: "ingress" },
  { method: "POST", path: "/ops/imports/schedules", category: "ingress" },
  { method: "POST", path: "/ops/imports/events", category: "ingress" },
  { method: "GET", path: "/ops/imports/history", category: "ingress" },
  { method: "POST", path: "/ops/scores/import", category: "ingress" },
  { method: "POST", path: "/ops/scores/game", category: "ingress" },
  { method: "POST", path: "/ops/scores/parse-image", category: "ingress" },
  { method: "POST", path: "/ops/potg/parse", category: "ingress" },
  { method: "POST", path: "/ops/potg/submit", category: "ingress" },
  { method: "POST", path: "/ops/store/media", category: "ingress" },
  { method: "GET", path: "/ops/ingest/job-1", category: "ingress" },
  { method: "POST", path: "/ops/ingest/job-1/approve", category: "ingress" },
  { method: "POST", path: "/ops/ingest/job-1/reject", category: "ingress" },
  { method: "POST", path: "/ops/ingest/job-1/replay", category: "ingress" },
  { method: "GET", path: "/ops/ingest/reconcile", category: "ingress" },
  { method: "POST", path: "/sync/drain", category: "ingress" },
  { method: "POST", path: "/webhooks/stripe", category: "ingress" },
];

const renderRoutes: RouteCase[] = [
  { method: "GET", path: "/api/public-config", category: "render" },
  { method: "GET", path: "/api/public/home", category: "render" },
  { method: "GET", path: "/api/public/products", category: "render" },
  { method: "GET", path: "/api/public/schedule", category: "render" },
  { method: "GET", path: "/api/public/potg", category: "render" },
  { method: "GET", path: "/api/public/media", category: "render" },
  { method: "GET", path: "/api/scores", category: "render" },
  { method: "GET", path: "/api/teams", category: "render" },
  { method: "GET", path: "/api/streams/status", category: "render" },
  { method: "GET", path: "/api/streams/reactions", category: "render" },
  { method: "GET", path: "/api/streams/game-1/reactions", category: "render" },
  { method: "POST", path: "/api/streams/game-1/react", category: "render" },
  { method: "GET", path: "/api/streams/game-1/preview", category: "render" },
  { method: "GET", path: "/api/streams/game-1/access", category: "render" },
  { method: "POST", path: "/api/streams/game-1/purchase", category: "render" },
  { method: "POST", path: "/api/streams/game-1/session", category: "render" },
  {
    method: "POST",
    path: "/api/streams/game-1/session/heartbeat",
    category: "render",
  },
  { method: "POST", path: "/api/streams/game-1/session/end", category: "render" },
  { method: "GET", path: "/api/streams/game-1/comments", category: "render" },
  { method: "POST", path: "/api/streams/game-1/comments", category: "render" },
];

async function callRoute(route: RouteCase): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: string | undefined;

  if (route.method === "POST") {
    headers["content-type"] = "application/json";
    body = "{}";
  }

  const req = new Request(`https://local${route.path}`, {
    method: route.method,
    headers,
    body,
  });

  return worker.fetch(req, env);
}

describe("ingress/render route checklist", () => {
  it("ingress endpoints are wired (no 404 route misses)", async () => {
    for (const route of ingressRoutes) {
      const res = await callRoute(route);
      expect(
        res.status,
        `${route.method} ${route.path} should be matched by worker router`,
      ).not.toBe(404);
    }
  });

  it("render endpoints are wired (no 404 route misses)", async () => {
    for (const route of renderRoutes) {
      const res = await callRoute(route);
      expect(
        res.status,
        `${route.method} ${route.path} should be matched by worker router`,
      ).not.toBe(404);
    }
  });
});
