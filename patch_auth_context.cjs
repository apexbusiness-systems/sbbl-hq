const fs = require('fs');
let content = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

// The caching logic should go near fetchProfileAndRoles in the file, or wrap it.
// Let's create a cached version.
const cachedFetch = `
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

async function getCachedProfile(userId: string) {
  const cacheKey = \`auth_profile_cache_\${userId}\`;

  // Try cache first
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < PROFILE_CACHE_TTL) {
        // Fire background revalidation
        fetchProfileAndRoles(userId).then(data => {
          sessionStorage.setItem(cacheKey, JSON.stringify({ ...data, timestamp: Date.now() }));
        }).catch(() => { /* silent */ });
        return parsed.data;
      }
    }
  } catch { /* ignore cache parse errors */ }

  // Network fetch
  try {
    const data = await fetchProfileAndRoles(userId);
    sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  } catch (err) {
    // Graceful degradation: log silently
    console.error('Failed to fetch profile', err);
    return { profile: null, roles: [] };
  }
}
`;

content = content.replace(
  "import { fetchProfileAndRoles, type AuthProfile } from '@/lib/api/auth';",
  "import { fetchProfileAndRoles, type AuthProfile } from '@/lib/api/auth';\n" + cachedFetch
);

// Update load() to use getCachedProfile
content = content.replace(
  "      const details = await fetchProfileAndRoles(data.session.user.id);",
  "      const details = await getCachedProfile(data.session.user.id);"
);

// Update onAuthStateChange to use getCachedProfile
content = content.replace(
  "        if (nextSession?.user?.id) {\n          void fetchProfileAndRoles(nextSession.user.id).then(({ profile: p, roles: r }) => {\n            setProfile(p);\n            setRoles(r);\n          }).catch(() => {\n            setProfile(null);\n            setRoles([]);\n          });\n        } else {",
  `        if (nextSession?.user?.id) {
          void getCachedProfile(nextSession.user.id).then(({ profile: p, roles: r }) => {
            setProfile(p);
            setRoles(r);
          });
        } else {`
);

// Implement debouncing: avoid re-fetching if user ID hasn't changed.
// Need to compare with current user id, but we are inside useEffect where `user` state is not updated synchronously.
// We can use a ref for the current user id.

content = content.replace(
  "import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';",
  "import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';"
);

content = content.replace(
  "  const [configAvailable, setConfigAvailable] = useState(true);",
  "  const [configAvailable, setConfigAvailable] = useState(true);\n  const currentUserIdRef = useRef<string | null>(null);"
);

content = content.replace(
  "    setUser(data.session?.user ?? null);",
  "    setUser(data.session?.user ?? null);\n    currentUserIdRef.current = data.session?.user?.id ?? null;"
);

content = content.replace(
  "        setUser(nextSession?.user ?? null);",
  "        setUser(nextSession?.user ?? null);\n        const nextUserId = nextSession?.user?.id ?? null;\n        if (currentUserIdRef.current === nextUserId) return;\n        currentUserIdRef.current = nextUserId;"
);


fs.writeFileSync('src/contexts/AuthContext.tsx', content);
