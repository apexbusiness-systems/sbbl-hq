import * as Sentry from "@sentry/react";
import React from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,

  // SDK is a no-op when DSN is absent — safe in local dev without a key.
  enabled: Boolean(import.meta.env.VITE_SENTRY_DSN),

  environment: import.meta.env.MODE,

  // Injected at build time via vite.config.ts define.
  release: import.meta.env.VITE_APP_VERSION as string | undefined,

  sendDefaultPii: true,

  integrations: [
    // React Router v6 — hooks pattern (BrowserRouter, not createBrowserRouter)
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    Sentry.replayIntegration({
      // Mask PII — SBBL HQ handles player profiles + payment flows
      maskAllText: true,
      blockAllMedia: true,
      // Capture Supabase API request/response metadata in replays for debugging.
      // Bodies are NOT captured (networkCaptureBodies defaults to false for unallowed URLs).
      networkDetailAllowUrls: [
        /^https:\/\/ezanilxygnpucwkwpsoc\.supabase\.co/,
      ],
      networkRequestHeaders: ["x-sbbl-league", "x-request-id"],
      networkResponseHeaders: ["x-request-id"],
    }),
  ],

  // Tracing
  // 100% in dev/staging; 10% in production — adjust after baseline is set.
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

  // Only propagate trace headers to our own backend (Cloudflare Worker + Supabase).
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/ezanilxygnpucwkwpsoc\.supabase\.co/,
    /^https:\/\/sbbl-hq\.pages\.dev/,
    /^https:\/\/sbblhq\.com/,
  ],

  // Parameterize dynamic route segments so Sentry groups by route pattern,
  // not individual IDs (e.g. /league/wbl → /league/:leagueId).
  beforeSend(event) {
    if (event.transaction) {
      event.transaction = event.transaction
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/<uuid>")
        .replace(/\/[a-f0-9]{20,}/gi, "/<hash>")
        .replace(/\/\d+/g, "/<id>");
    }
    return event;
  },

  // Suppress high-volume browser noise that isn't actionable.
  ignoreErrors: [
    // Browser extensions injecting into the page
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Safari/iOS network quirks
    "The network connection was lost",
    "NetworkError when attempting to fetch resource",
    // PWA / Service Worker lifecycle (benign)
    "ServiceWorker registration failed",
    // Benign Supabase auth redirect noise
    "Invalid login credentials",
    // Ad blockers / privacy badgers blocking non-critical requests
    /blocked by the client/i,
  ],

  // Session Replay
  // 10% of all sessions; 100% of sessions that include an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
