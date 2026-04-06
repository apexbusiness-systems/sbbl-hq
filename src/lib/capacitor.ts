/**
 * Capacitor native bridge — initializes native plugins when running
 * inside a Capacitor shell (iOS/Android). No-ops gracefully on web.
 */
import { Capacitor } from '@capacitor/core';

/** True when running inside the native Capacitor shell */
export const isNative = Capacitor.isNativePlatform();

/**
 * Initialise native plugins. Call once at app boot (main.tsx).
 * Safe to call on web — every import is guarded by `isNative`.
 */
export async function initNativePlugins() {
  if (!isNative) return;

  // StatusBar — dark content, match app background
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: '#0A0A0A' });

  // Hide the native splash once the React tree is mounted
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide();

  // Deep-link / back-button handling
  const { App: CapApp } = await import('@capacitor/app');
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      CapApp.exitApp();
    }
  });
}
