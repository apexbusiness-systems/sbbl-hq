import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('SBBL HQ'),
  VITE_DEFAULT_LEAGUE: z.enum(['SBBL', 'WBL', 'TGIFBL']).default('SBBL'),
  VITE_DEFAULT_PPV_PRICE: z.coerce.number().positive().default(2.5),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
});

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(16),
  STRIPE_SECRET_KEY: z.string().min(16),
  STRIPE_WEBHOOK_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().min(16),
  OPTIONAL_SOCIAL_API_KEYS: z.string().optional(),
  OPTIONAL_TURNSTILE_SECRET_KEY: z.string().optional(),
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
