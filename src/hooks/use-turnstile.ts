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
  if (scriptLoaded) {
    onReady();
    return;
  }
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
 * Manages one Cloudflare Turnstile widget in execution="execute" mode.
 *
 * Timeout policy:
 * - if Turnstile does not resolve inside TOKEN_TIMEOUT_MS, resolveToken() returns
 *   undefined so sign-in can attempt the server-side fallback path instead of
 *   hard-blocking the user in a local timeout loop.
 */
export function useTurnstile() {
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{
    resolve: (token: string | undefined) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  const clearPendingTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

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
          clearPendingTimeout();
          pendingRef.current?.resolve(token);
          pendingRef.current = null;
        },
        'error-callback': () => {
          clearPendingTimeout();
          pendingRef.current?.reject(new Error('captcha_failed'));
          pendingRef.current = null;
        },
        'expired-callback': () => {
          // Token expired before use; next resolveToken() call resets + executes.
        },
      } as Record<string, unknown>);

      setReady(true);
    };

    loadTurnstileScript(mountWidget);

    return () => {
      clearPendingTimeout();
      if (pendingRef.current) {
        pendingRef.current.reject(new Error('captcha_cancelled'));
        pendingRef.current = null;
      }
    };
  }, [siteKey]);

  /**
   * Resolves a fresh Turnstile token.
   *
   * Returns undefined when no site key is configured or when challenge times out.
   */
  async function resolveToken(): Promise<string | undefined> {
    if (!siteKey) return undefined;

    const tw = (window as unknown as TurnstileWindow).turnstile;
    if (!tw || !widgetIdRef.current) throw new Error('captcha_loading');

    clearPendingTimeout();
    if (pendingRef.current) {
      pendingRef.current.reject(new Error('captcha_replaced'));
      pendingRef.current = null;
    }

    tw.reset(widgetIdRef.current);

    return new Promise<string | undefined>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      tw.execute(widgetIdRef.current!);

      timeoutRef.current = window.setTimeout(() => {
        if (!pendingRef.current) return;
        const pending = pendingRef.current;
        pendingRef.current = null;
        clearPendingTimeout();
        pending.resolve(undefined);
      }, TOKEN_TIMEOUT_MS);
    });
  }

  return { containerRef, resolveToken, ready: !siteKey || ready };
}
