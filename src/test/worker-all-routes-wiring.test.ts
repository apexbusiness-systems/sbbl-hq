import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import worker from "@/worker/index";

type RouteInventory = {
  generated_at: string;
  count: number;
  routes: Array<{
    method: string;
    path?: string;
    regex?: string;
    type: "path" | "regex";
  }>;
};

type RouteCase = {
  method: string;
  routeLabel: string;
  concretePath: string;
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

const paramSamples: Record<string, string> = {
  id: "id-1",
  gameId: "game-1",
  jobId: "job-1",
  itemId: "item-1",
  kind: "store",
  action: "delete",
};

function concretePathFromPattern(pattern: string): string {
  if (pattern === "/^\\/ops\\/ingest\\/(?<jobId>[^\\/]+)\\/?$/") {
    return "/ops/ingest/job-1";
  }
  if (pattern === "/^\\/ops\\/ingest\\/(?<jobId>[^\\/]+)\\/approve\\/?$/") {
    return "/ops/ingest/job-1/approve";
  }
  if (pattern === "/^\\/ops\\/ingest\\/(?<jobId>[^\\/]+)\\/reject\\/?$/") {
    return "/ops/ingest/job-1/reject";
  }
  if (pattern === "/^\\/ops\\/ingest\\/(?<jobId>[^\\/]+)\\/replay\\/?$/") {
    return "/ops/ingest/job-1/replay";
  }
  if (pattern === "/^\\/ops\\/manual\\/(?<kind>[^\\/]+)\\/(?<action>[^\\/]+)\\/?$/") {
    return "/ops/manual/store/delete";
  }
  if (pattern === "/^\\/ops\\/ingest\\/reconcile\\/?$/") {
    return "/ops/ingest/reconcile";
  }
  throw new Error(`Unmapped regex route pattern: ${pattern}`);
}

function concretePathFromTemplate(pathTemplate: string): string {
  return pathTemplate.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    return paramSamples[key] ?? "x";
  });
}

function loadRouteCases(): RouteCase[] {
  const inventoryPath = resolve(
    __dirname,
    "../../docs/quality/evidence/route_inventory_2026-04-07.json",
  );
  const inventoryRaw = readFileSync(inventoryPath, "utf-8");
  const inventory = JSON.parse(inventoryRaw) as RouteInventory;

  const routeCases: RouteCase[] = inventory.routes.map((route) => {
    if (route.type === "path" && route.path) {
      return {
        method: route.method,
        routeLabel: route.path,
        concretePath: concretePathFromTemplate(route.path),
      };
    }

    if (route.type === "regex" && route.regex) {
      return {
        method: route.method,
        routeLabel: route.regex,
        concretePath: concretePathFromPattern(route.regex),
      };
    }

    throw new Error("Invalid route record in inventory");
  });

  return routeCases;
}

async function callRoute(route: RouteCase): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  const methodUpper = route.method.toUpperCase();

  if (["POST", "PATCH", "PUT", "DELETE"].includes(methodUpper)) {
    headers["content-type"] = "application/json";
    headers["Idempotency-Key"] = `qa-${methodUpper}-${route.concretePath}`;
    body = "{}";
  }

  const req = new Request(`https://local${route.concretePath}`, {
    method: methodUpper,
    headers,
    body,
  });

  return worker.fetch(req, env);
}

describe("all worker routes wiring checklist", () => {
  it("every registered route is matched by router (no route-level 404 misses)", async () => {
    const routeCases = loadRouteCases();
    expect(routeCases.length).toBe(90);

    for (const route of routeCases) {
      const res = await callRoute(route);
      expect(
        res.status,
        `${route.method} ${route.routeLabel} (${route.concretePath}) should be matched by worker router`,
      ).not.toBe(404);
    }
  });
});
