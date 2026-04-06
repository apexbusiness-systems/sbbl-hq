# SBBL HQ — App Store Submission Checklist

## Pre-Submission (Code)

- [x] Capacitor config (`capacitor.config.ts`) — app ID, plugins, native settings
- [x] Native Capacitor plugins installed — StatusBar, SplashScreen, Keyboard, App, Haptics, Browser, Share
- [x] Native bridge init (`src/lib/capacitor.ts`) — StatusBar, SplashScreen, back-button handling
- [x] Privacy Policy page (`/privacy`)
- [x] Terms of Service page (`/terms`)
- [x] Support page (`/support`)
- [x] App store metadata (`appstore/metadata.json`)
- [x] All icon sizes generated (iOS: 14 sizes, Android: 7 sizes, plus universal)
- [x] PWA manifest configured with all required fields
- [x] Service worker with offline support
- [x] Splash screen (React + native Capacitor)
- [x] Deep link / back-button handling for Android

## Generate Native Projects

```bash
# Build the web app first
npm run build

# Generate iOS and Android projects
npx cap add ios
npx cap add android

# Sync web assets into native projects
npx cap sync
```

## iOS — App Store Connect

- [ ] Open Xcode: `npx cap open ios`
- [ ] Set Team & Signing in Xcode → Signing & Capabilities
- [ ] Set bundle ID: `com.sbblhq.app`
- [ ] Set version: `1.0.0` (Build: `1`)
- [ ] Set minimum deployment target: iOS 16.0
- [ ] Add App Icons via Xcode Asset Catalog (use `public/icons/ios-app-icon-*.png`)
- [ ] Configure splash screen (LaunchScreen.storyboard)
- [ ] Add NSAppTransportSecurity exception if needed
- [ ] Add required privacy descriptions to Info.plist:
  - `NSCameraUsageDescription` — "Used to capture your player headshot photo"
  - `NSPhotoLibraryUsageDescription` — "Used to select your player headshot from your photo library"
- [ ] Test on physical device
- [ ] Archive & Upload to App Store Connect
- [ ] Fill in App Store listing (copy from `appstore/metadata.json`)
- [ ] Upload screenshots (see metadata.json for required sizes)
- [ ] Set pricing: Free (with in-app purchases)
- [ ] Submit for review

## Android — Google Play Console

- [ ] Open Android Studio: `npx cap open android`
- [ ] Set applicationId: `com.sbblhq.app` in `android/app/build.gradle`
- [ ] Set versionCode: `1`, versionName: `1.0.0`
- [ ] Set minSdk: 24, targetSdk: 35
- [ ] Generate signed APK/AAB with release keystore
- [ ] Test on physical device
- [ ] Create app in Google Play Console
- [ ] Fill in store listing (copy from `appstore/metadata.json`)
- [ ] Upload screenshots (see metadata.json for required sizes)
- [ ] Complete content rating questionnaire
- [ ] Complete Data Safety section:
  - Data collected: Name, email, payment info, usage data
  - Data shared: None sold; shared with Stripe (payments), Sentry (crashes)
  - Data encrypted in transit: Yes
  - Data deletion: Users can request deletion via email
- [ ] Set pricing: Free (with in-app purchases)
- [ ] Upload signed AAB
- [ ] Submit for review

## Post-Submission

- [ ] Monitor review status in both consoles
- [ ] Respond to reviewer questions promptly
- [ ] Prepare test account credentials if requested by reviewers
