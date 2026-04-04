import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
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
    'sb_publishable_5uIVxDWuaI916HXVN9Mb8A_jhrYLPYz';

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
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
          // Serve /offline as the fallback for navigation requests that miss
          // both the network and the app-shell-navigations cache.
          navigateFallback: '/offline',
          // Only apply the fallback to app routes — never to API, auth, or assets.
          navigateFallbackDenylist: [
            /^\/rest\/v1\//,
            /^\/auth\//,
            /^\/storage\//,
            /^\/functions\//,
            /^\/assets\//,
          ],
          runtimeCaching: [
            // App shell navigations: Stale-While-Revalidate
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'app-shell-navigations',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 1 week
              },
            },
            // Hashed JS/CSS/Fonts: Cache-First
            {
              urlPattern: ({ request }) =>
                request.destination === 'script' ||
                request.destination === 'style' ||
                request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
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
      mode === "development" && componentTagger(),
    ].filter(Boolean),

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
            if (
              id.includes("/node_modules/@eyevinn/") ||
              id.includes("/node_modules/react-player/")
            ) {
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
