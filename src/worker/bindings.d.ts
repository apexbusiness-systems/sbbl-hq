interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  OPTIONAL_SOCIAL_API_KEYS?: string;
  OPTIONAL_TURNSTILE_SECRET_KEY?: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}
