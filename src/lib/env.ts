import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('SBBL HQ'),
  VITE_DEFAULT_LEAGUE: z.enum(['SBBL', 'WBL', 'TGIFBL']).default('SBBL'),
  VITE_DEFAULT_PPV_PRICE: z.coerce.number().positive().default(2.5),
  VITE_PUBLIC_BASE_URL: z.string().url().default('http://localhost:5173'),
  // Optional to avoid hard-crashing the SPA when env vars are missing in preview/prod.
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).optional(),
  // Backward-compatible alias used by many Supabase/Vite templates.
  VITE_SUPABASE_ANON_KEY: z.string().min(10).optional(),
  VITE_WORKER_API_BASE: z.string().optional(),
});

// Normalize empty secrets from runtime env/deploy systems.
// Cloudflare/GitHub can materialize unset optional secrets as empty strings,
// which should be treated as "not set" instead of hard-failing validation.
const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.trim() === '' ? undefined : value;
};

const optionalServerKey = z.preprocess(emptyToUndefined, z.string().min(10).optional());
const optionalServerSecret = z.preprocess(emptyToUndefined, z.string().min(16).optional());
const optionalServerUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalServerString = z.preprocess(emptyToUndefined, z.string().optional());

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: optionalServerKey,
  // Backward-compatible alias used in some deployments.
  SUPABASE_ANON_KEY: optionalServerKey,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(16),
  STRIPE_SECRET_KEY: optionalServerSecret,
  STRIPE_WEBHOOK_SECRET: optionalServerSecret,
  RESEND_API_KEY: optionalServerSecret,
  OMNIHUB_SYNC_URL: optionalServerUrl,
  OMNIHUB_SIGNING_SECRET: optionalServerSecret,
  OMNIHUB_VERIFY_KEY: optionalServerSecret,
  OPTIONAL_SOCIAL_API_KEYS: optionalServerString,
  OPTIONAL_TURNSTILE_SECRET_KEY: optionalServerString,
  BROADCAST_STREAM_URL: optionalServerString,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readClientEnv(source: Record<string, unknown> = import.meta.env): ClientEnv {
  return clientEnvSchema.parse(source);
}

export function readServerEnv(source: Record<string, unknown>): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function safeServerEnv(source: Record<string, unknown>) {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    return {
      ok: false as const,
      missing: parsed.error.issues.map((issue) => issue.path.join('.')),
    };
  }

  return {
    ok: true as const,
    value: parsed.data,
  };
}
