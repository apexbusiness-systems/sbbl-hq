import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { createRequire } from "node:module";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // VITE_SUPABASE_URL and the publishable key are public credentials —
  // the anon/publishable key is safe to embed in the client bundle (Supabase RLS
  // protects data, not the key). They are already committed in wrangler.jsonc.
  // Fallbacks here mean the build never fails on CI or a fresh clone just because
  // .env is absent.
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://ezanilxygnpucwkwpsoc.supabase.co';
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6YW5pbHh5Z25wdWN3a3dwc29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjI5OTIsImV4cCI6MjA5MDE5ODk5Mn0.kLbwopHDqf33H9flwIbO5XqfPYdi0wMqjeVJC76-Ceo';
    const turnstileSiteKey =
    env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAACz241-XHmFaqRrM';

  // Sentry release: use git SHA injected by CI (VITE_APP_VERSION) or fall back
  // to a timestamp so every build produces a unique release string.
  const appVersion = env.VITE_APP_VERSION || `sbbl-hq@${Date.now()}`;

  // Sentry: conditionally load only when the auth token is present at build time.
  // createRequire is used because vite.config.ts runs as ESM ("type":"module")
  // but @sentry/vite-plugin requires a synchronous load before the config object
  // is returned. Falls back to empty array if package is not installed.
  let sentryPlugins: import('vite').PluginOption[] = [];
  if (env.SENTRY_AUTH_TOKEN) {
    try {
      const _require = createRequire(import.meta.url);
     
      const { sentryVitePlugin } = _require('@sentry/vite-plugin');
      sentryPlugins = [sentryVitePlugin({
        org: env.SENTRY_ORG || 'apex-business-systems',
        project: env.SENTRY_PROJECT || 'sbbl-hq-frontend',
        authToken: env.SENTRY_AUTH_TOKEN,
        release: { name: appVersion },
        sourcemaps: { filesToDeleteAfterUpload: ['dist/assets/*.js.map'] },
        telemetry: false,
      })];
    } catch {
      // @sentry/vite-plugin not installed — skip silently
    }
  }

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
            'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(turnstileSiteKey),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "robots.txt", "icons/apple-touch-icon.svg", "icons/ios-app-icon-180.png"],
        manifest: {
          name: "SBBL HQ",
          short_name: "SBBL HQ",
          description: "SBBL HQ mobile app for live games, schedules, stats, media, and merch.",
          theme_color: "#0f0f0f",
          background_color: "#0f0f0f",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          icons: [
            { src: "/icons/app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/app-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "/icons/google-play-icon-36.png", sizes: "36x36", type: "image/png" },
            { src: "/icons/google-play-icon-48.png", sizes: "48x48", type: "image/png" },
            { src: "/icons/google-play-icon-72.png", sizes: "72x72", type: "image/png" },
            { src: "/icons/google-play-icon-96.png", sizes: "96x96", type: "image/png" },
            { src: "/icons/google-play-icon-144.png", sizes: "144x144", type: "image/png" },
            { src: "/icons/google-play-icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/google-play-icon-512.png", sizes: "512x512", type: "image/png" }
          ]
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // No navigateFallback — no /offline page exists. Navigation misses fall
          // through to the network (NetworkFirst ensures fresh CSP headers are
          // always delivered; stale shell would carry old CSP blocking YouTube API).
          runtimeCaching: [
            // App shell navigations: NetworkFirst with 3s timeout.
            // Critical: always fetches a fresh response so Cloudflare delivers
            // up-to-date Content-Security-Policy headers (required for YouTube
            // IFrame API script-src allowlisting). Falls back to cache on
            // network timeout/offline only.
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'app-shell-navigations',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 1 week
              },
            },
            // External player APIs: NetworkOnly — YouTube/Twitch/Vimeo ship live player
            // updates multiple times per week. A 30-day stale iframe_api breaks live ingest.
            {
              urlPattern: ({ url }) =>
                (url.hostname === 'www.youtube.com' && url.pathname.includes('iframe_api')) ||
                url.hostname === 's.ytimg.com' ||
                (url.hostname === 'embed.twitch.tv' && (url.pathname.endsWith('.js') || url.pathname.includes('embed'))) ||
                (url.hostname === 'assets.twitch.tv' && url.pathname.endsWith('.js')) ||
                (url.hostname === 'player.vimeo.com' && url.pathname.endsWith('.js')),
              handler: 'NetworkOnly',
            },
            // Self-hosted hashed JS/CSS/Fonts: CacheFirst (Vite content-hashes guarantee freshness)
            {
              urlPattern: ({ request, url }) =>
                (request.destination === 'script' ||
                 request.destination === 'style' ||
                 request.destination === 'font') &&
                (url.hostname === 'sbbl-hq.icu' ||
                 url.hostname === 'www.sbbl-hq.icu' ||
                 url.hostname === 'localhost' ||
                 url.hostname === '127.0.0.1'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Images: Cache-First with caps
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 }, // 14 days
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Briefly stale-safe public API reads: Stale-While-Revalidate
            {
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                url.pathname.startsWith('/rest/v1/') &&
                !url.pathname.includes('/auth/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'public-api-reads',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 }, // 5 minutes
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Mutations / Auth / Protected: Network-Only
            {
              urlPattern: ({ request, url }) =>
                request.method !== 'GET' ||
                url.pathname.includes('/auth/'),
              handler: 'NetworkOnly',
            }
          ],
        },
        devOptions: { enabled: true },
      }),
      ...sentryPlugins,
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },

    // Pre-bundle heavy deps in dev to eliminate cold-start waterfall
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@tanstack/react-query",
        "@supabase/supabase-js",
        "framer-motion",
        "recharts",
        "rxdb",
        "rxjs",
        "date-fns",
        "zod",
      ],
    },

    build: {
      // Hidden source maps: readable stack traces in Sentry without exposing
      // source to end users. The sentryVitePlugin deletes .map files post-upload.
      sourcemap: "hidden",

      // Silence warnings only on chunks we know are intentionally large (rxdb, media)
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          // Deterministic, cache-friendly names: stable name + content hash.
          // The hash changes only when the chunk's own content changes,
          // so react-vendor stays cached across app-code deploys.
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",

          /**
           * manualChunks — SBBL HQ bundle strategy
           *
           * Chunk                 Gzip target   Rationale
           * ─────────────────────────────────────────────────────────────────
           * react-vendor          ~50 KB        Core React runtime — near-zero
           *                                     churn; max cache TTL
           * query-vendor          ~20 KB        TanStack Query — API stable
           * supabase-vendor       ~55 KB        Supabase SDK — auth + realtime
           * ui-vendor             ~230 KB       All Radix + framer-motion +
           *                                     icon set + UI utilities
           * charts-vendor         ~90 KB        recharts + D3 sub-deps
           * rxdb-vendor           ~200 KB       RxDB + RxJS + idb + jose —
           *                                     offline sync, load once
           * media-vendor          ~120 KB       WebRTC + react-player —
           *                                     Live page only
           * utils-vendor          ~45 KB        date-fns + zod + clsx
           * forms-vendor          ~25 KB        react-hook-form + resolvers
           */
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;

            // ── React core runtime ──────────────────────────────────────────
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/react-router-dom/") ||
              id.includes("/node_modules/@remix-run/") ||
              id.includes("/node_modules/scheduler/")
            ) {
              return "react-vendor";
            }

            // ── TanStack Query ──────────────────────────────────────────────
            if (id.includes("/node_modules/@tanstack/")) {
              return "query-vendor";
            }

            // ── Supabase SDK (auth, realtime, postgrest, storage) ───────────
            if (id.includes("/node_modules/@supabase/")) {
              return "supabase-vendor";
            }

            // ── RxDB + RxJS + IndexedDB + jose (offline sync stack) ─────────
            if (
              id.includes("/node_modules/rxdb/") ||
              id.includes("/node_modules/rxjs/") ||
              id.includes("/node_modules/idb/") ||
              id.includes("/node_modules/jose/") ||
              id.includes("/node_modules/pwa-helpers/")
            ) {
              return "rxdb-vendor";
            }

            // ── Charts (recharts + D3 sub-deps) ─────────────────────────────
            if (
              id.includes("/node_modules/recharts/") ||
              id.includes("/node_modules/d3") ||
              id.includes("/node_modules/victory-vendor/")
            ) {
              return "charts-vendor";
            }

            // ── Media / WebRTC (Live page only) ──────────────────────────────
            // NOTE: react-player calls React.lazy() at module init time.
            // It MUST NOT be separated from React — left to default chunking
            // so Rollup resolves the React dependency correctly.
            if (id.includes("/node_modules/@eyevinn/")) {
              return "media-vendor";
            }

            // ── UI primitives + animation + icons ───────────────────────────
            if (
              id.includes("/node_modules/@radix-ui/") ||
              id.includes("/node_modules/framer-motion/") ||
              id.includes("/node_modules/lucide-react/") ||
              id.includes("/node_modules/cmdk/") ||
              id.includes("/node_modules/vaul/") ||
              id.includes("/node_modules/sonner/") ||
              id.includes("/node_modules/next-themes/") ||
              id.includes("/node_modules/embla-carousel") ||
              id.includes("/node_modules/react-resizable-panels/") ||
              id.includes("/node_modules/react-day-picker/") ||
              id.includes("/node_modules/input-otp/") ||
              id.includes("/node_modules/class-variance-authority/") ||
              id.includes("/node_modules/tailwind-merge/") ||
              id.includes("/node_modules/tailwindcss-animate/")
            ) {
              return "ui-vendor";
            }

            // ── Utilities ────────────────────────────────────────────────────
            if (
              id.includes("/node_modules/date-fns/") ||
              id.includes("/node_modules/zod/") ||
              id.includes("/node_modules/clsx/")
            ) {
              return "utils-vendor";
            }

            // ── Forms ────────────────────────────────────────────────────────
            if (
              id.includes("/node_modules/react-hook-form/") ||
              id.includes("/node_modules/@hookform/")
            ) {
              return "forms-vendor";
            }

            // All remaining node_modules fall through to Rollup's default
            // chunking — this keeps Capacitor, turnstile, and other
            // infrequently-used deps out of the critical-path chunks.
            return undefined;
          },
        },
      },
    },
  };
});
