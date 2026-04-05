# Post-Mortem: Thundering Herd & Botnet Attack (2026-04-03)

## Incident Summary
The application experienced a dual-vector degradation resulting in cascading 429 and 500 errors.
1. **Thundering Herd:** Real traction (2,000+ concurrent viewers) caused a session-refresh crash. During hard refreshes, all active clients simultaneously requested user profile data from Supabase.
2. **Botnet Injection:** An automated botnet injected 11,000+ requests to the unprotected `/signup` endpoint, exhausting the Postgres connection pool.

## Mitigation
To stabilize the platform, a hybrid-shield defense was deployed:

### 1. Edge Defense: Cloudflare Turnstile
- **Integration:** `@marsidev/react-turnstile` was integrated into the frontend `LoginPage` component.
- **Execution:** The Turnstile widget only mounts when the user explicitly triggers "signup" mode, remaining completely invisible during standard sign-in.
- **Enforcement:** The `signUpWithPassword` API utility was modified to transmit the Turnstile `captchaToken` securely into the `supabase.auth.signUp()` payload options. Without this token, the request is mathematically blocked.

### 2. Client-Side Thundering Herd Mitigation
- **Caching Layer:** `AuthContext` now utilizes `sessionStorage` to cache user profile and role data with a 5-minute TTL.
- **Stale-While-Revalidate:** The app hydrates immediately from the local cache to maintain zero UI friction, while firing a background request to fetch fresh data.
- **Deduplication:** `onAuthStateChange` listeners were debounced against the currently loaded `user.id` to prevent redundant network requests.
- **Degradation Handling:** If the network fetch fails, the app catches the error and degrades gracefully without crashing the React application tree.

## Runbook Action Items
- Monitor Cloudflare Turnstile analytics for bot mitigation metrics.
- Ensure `VITE_TURNSTILE_SITE_KEY` (and optionally `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) are present in environment variables. If absent or invalid, the signup form will default to blocking signups.
