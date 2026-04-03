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
          // globPatterns deliberately omitted — vite-plugin-pwa defaults to
          // ["**/*.{js,css,html,ico,png,svg,jpg,jpeg}"] in production, and
          // omitting it prevents a spurious dev-dist warning when the Vite
          // dev server starts before the dist directory is populated.
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/sbbl-hq\.icu\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "sbbl-hq-cache",
                expiration: { maxEntries: 200 },
              },
            },
            {
              urlPattern: ({ request }: { request: Request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "sbblhq-images",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
              },
            },
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
  };
});
