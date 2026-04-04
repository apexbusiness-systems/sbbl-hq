import type { SupabaseClient } from "@supabase/supabase-js";

export type HandlerCtx = {
  req: Request;
  env: Env;
  params: Record<string, string>;
  admin: SupabaseClient;
};

export type Handler = (ctx: HandlerCtx) => Promise<Response>;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
