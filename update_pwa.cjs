const fs = require('fs');

const code = fs.readFileSync('vite.config.ts', 'utf-8');

const regex = /workbox:\s*\{[\s\S]*?devOptions:/;

const newWorkbox = `workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
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
        devOptions:`;

let newCode = code.replace(regex, newWorkbox);

fs.writeFileSync('vite.config.ts', newCode);
console.log('Updated vite.config.ts');
