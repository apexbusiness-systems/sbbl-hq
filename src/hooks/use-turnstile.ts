import { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_TIMEOUT_MS = 15_000;

type TurnstileWindow = Window & {
  turnstile?: {
    render: (container: HTMLElement, opts: Record<string, unknown>) => string;
    execute: (widgetId: string) => void;
    reset: (widgetId: string) => void;
  };
};

let scriptLoaded = false;
let scriptLoading = false;
const scriptCallbacks: Array<() => void> = [];

function loadTurnstileScript(onReady: () => void): void {
  if (scriptLoaded) { onReady(); return; }
  scriptCallbacks.push(onReady);
  if (scriptLoading) return;
  scriptLoading = true;
  const script = document.createElement('script');
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.addEventListener('load', () => {
    scriptLoaded = true;
    scriptLoading = false;
    scriptCallbacks.splice(0).forEach((cb) => cb());
  });
  document.head.appendChild(script);
}

/**
 * Manages a single Cloudflare Turnstile widget in `execution: 'execute'` mode
 * (invisible until `resolveToken()` is called).
 *
 * Usage:
 *   const { containerRef, resolveToken, ready } = useTurnstile();
 *   // Mount: <div ref={containerRef} className="sr-only" aria-hidden />
 *   // Before submit: const token = await resolveToken();
 *
 * When VITE_TURNSTILE_SITE_KEY is absent, `resolveToken` returns `undefined`
 * and the Supabase call skips captcha — safe for local/dev environments.
 */
export function useTurnstile() {
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const mountWidget = () => {
      const tw = (window as unknown as TurnstileWindow).turnstile;
      if (!tw || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = tw.render(containerRef.current, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => {
          pendingRef.current?.resolve(token);
          pendingRef.current = null;
        },
        'error-callback': () => {
          pendingRef.current?.reject(new Error('captcha_failed'));
          pendingRef.current = null;
        },
        'expired-callback': () => {
          // Token expired before it was consumed — will be reset on next execute()
        },
      } as Record<string, unknown>);
      setReady(true);
    };

    loadTurnstileScript(mountWidget);

    // If script was already loaded synchronously, mountWidget ran immediately;
    // if it loaded async, it ran via the callback. Either way we're good.
    return () => {
      // Don't destroy the widget on cleanup — it may be remounted quickly
      // (e.g. StrictMode double-effect). The widgetIdRef guard prevents double-render.
    };
  }, [siteKey]);

  /**
   * Resolves a fresh Turnstile token. Returns `undefined` when no site key is
   * configured (dev/local). Throws with `.message` of:
   *   - 'captcha_loading'  — widget not yet mounted
   *   - 'captcha_timeout'  — Cloudflare didn't respond within 15 s
   *   - 'captcha_failed'   — Cloudflare returned an error
   */
  async function resolveToken(): Promise<string | undefined> {
    if (!siteKey) return undefined;
    const tw = (window as unknown as TurnstileWindow).turnstile;
    if (!tw || !widgetIdRef.current) throw new Error('captcha_loading');

    tw.reset(widgetIdRef.current);

    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      tw.execute(widgetIdRef.current!);

      window.setTimeout(() => {
        if (pendingRef.current) {
          pendingRef.current.reject(new Error('captcha_timeout'));
          pendingRef.current = null;
        }
      }, TOKEN_TIMEOUT_MS);
    });
  }

  return { containerRef, resolveToken, ready: !siteKey || ready };
}
