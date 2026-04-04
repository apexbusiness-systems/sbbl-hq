<!-- Version: v1.1.0 | Date: 2026-04-04 | Status: Current -->
# PWA + Capacitor Setup

## What is included
- Vite PWA plugin with auto-update service worker and installable manifest.
- iOS-compatible apple touch icon/meta tags.
- Persistent floating install CTA (`AppDownloadPill`) for Android/iOS reminder UX.
- Capacitor config and scripts for native packaging.

## Commands
- `npm run cap:sync` build web + sync iOS/Android projects.
- `npm run cap:copy` copy updated web assets into existing native projects.
- `npm run cap:open:ios` open in Xcode.
- `npm run cap:open:android` open in Android Studio.

## Icon pipeline
- Canonical app icons are served from `public/icons/` and wired via the PWA manifest and Apple touch icon tags.
