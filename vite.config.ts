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
        includeAssets: ["favicon.svg", "robots.txt", "icons/apple-touch-icon.svg"],
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
            { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
            { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable any" }
          ]
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/',
          navigateFallbackAllowlist: [/^(?!\/api).*/],
          runtimeCaching: [
            {
              // Stale-While-Revalidate for HTML navigations (App Shell)
              urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'app-shell-cache',
                expiration: { maxEntries: 50 },
                precacheFallback: { fallbackURL: '/' }
              }
            },
            {
              // Cache-First with 1-year expiration for immutable, hashed static assets
              urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                request.destination === 'script' ||
                request.destination === 'style' ||
                request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets-cache',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              // Cache-First with strict 30-day expiration for dynamic images
              urlPattern: ({ request }: { request: Request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'dynamic-images-cache',
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              // Stale-While-Revalidate for low-priority, dynamic API reads
              urlPattern: ({ url, request }: { url: URL; request: Request }) =>
                request.method === 'GET' && (url.pathname.startsWith('/api/public/home') || url.pathname.startsWith('/api/streams/status')),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'dynamic-api-reads-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              // Strict Network-Only for all data mutations to prevent caching stale authorization states
              urlPattern: ({ request }: { request: Request }) => request.method !== 'GET',
              handler: 'NetworkOnly',
            }
          ]
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
  };
});
