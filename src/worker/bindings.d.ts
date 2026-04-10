interface Env {
  SENTRY_DSN?: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  OMNIHUB_SYNC_URL?: string;
  OMNIHUB_SIGNING_SECRET?: string;
  OMNIHUB_VERIFY_KEY?: string;
  OPTIONAL_SOCIAL_API_KEYS?: string;
  OPTIONAL_TURNSTILE_SECRET_KEY?: string;
  GROQ_API_KEY?: string;
  ENABLE_STREAM_VALIDATION?: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}
