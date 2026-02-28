# Native Try-On SDK Integration

## 1) Runtime contract from JS

Mobile app now calls a native module from:

- `src/services/nativeTryOnService.js`

Expected module name:

- `EXPO_PUBLIC_TRYON_NATIVE_MODULE` (default: `WdpTryOnSdk`)

Expected native methods (implement at least one):

- `startTryOnSession(payload)`
- `startSession(payload)`
- `openTryOn(payload)`

Payload shape sent from JS:

```json
{
  "sdkKey": "string",
  "productId": "string",
  "productName": "string",
  "status": "published",
  "published": true,
  "ready": true,
  "arUrl": "https://...",
  "modelUrl": "https://...glb|usdz",
  "glbUrl": "https://...",
  "usdzUrl": "https://...",
  "fallbackUrl": "https://...",
  "assetIds": ["assetId1", "assetId2"],
  "platform": "ios|android"
}
```

## 2) App flow

- Product detail -> `TryOnARScreen`
- Screen tries native SDK first (if available and enabled)
- If native fails/unavailable -> auto fallback to WebView URL (`tryOnService`)

## 3) Environment variables

Add to `.env`:

```env
EXPO_PUBLIC_TRYON_PREFER_NATIVE=true
EXPO_PUBLIC_TRYON_NATIVE_MODULE=WdpTryOnSdk
EXPO_PUBLIC_TRYON_API_KEY=your_native_or_vendor_key
EXPO_PUBLIC_TRYON_SDK_URL=https://your-web-fallback-endpoint
```

## 4) Build requirement

Native SDK does not work in Expo Go. Use development build:

```bash
npx expo prebuild --platform android
npx expo run:android
```

`app.json` already includes `expo-dev-client` plugin.

## 5) Native team handoff

Native team only needs to:

1. Link Banuba Face AR SDK in Android.
2. Expose one method above on module `WdpTryOnSdk` (or set custom env module name).
3. Open AR camera scene using payload model URLs.
4. Resolve Promise when AR session closes or fails.

## 6) Banuba gradle config

Configure in `android/gradle.properties` (or better in `~/.gradle/gradle.properties` for secrets):

```properties
BANUBA_ENABLED=true
BANUBA_SDK_VERSION=<banuba-version>
BANUBA_LICENSE_TOKEN=<banuba-license-token>
BANUBA_MAVEN_URL=<banuba-maven-url>
BANUBA_MAVEN_USER=<banuba-maven-username>
BANUBA_MAVEN_PASSWORD=<banuba-maven-password>
```

Current build files already read these values:

- `android/build.gradle` for Banuba Maven repository.
- `android/app/build.gradle` for Banuba dependencies and `BuildConfig` fields.

Notes:

- `BANUBA_MAVEN_URL` defaults to `https://nexus.banuba.net/repository/maven-releases`.
- If your token must stay local, set `BANUBA_LICENSE_TOKEN` in `%USERPROFILE%\\.gradle\\gradle.properties` or environment variables.

## Android skeleton already added

Current Android bridge files:

- `android/app/src/main/java/com/anonymous/WDP301_Mobile/WdpTryOnSdkModule.kt`
- `android/app/src/main/java/com/anonymous/WDP301_Mobile/WdpTryOnSdkPackage.kt`
- `android/app/src/main/java/com/anonymous/WDP301_Mobile/WdpTryOnActivity.kt`

Registered in:

- `android/app/src/main/java/com/anonymous/WDP301_Mobile/MainApplication.kt`
- `android/app/src/main/AndroidManifest.xml`

## 7) Banuba integration point

`WdpTryOnActivity` now starts Banuba camera session directly:

- Initializes Banuba with token + optional `resourcePaths`.
- Attaches `SurfaceView` to `BanubaSdkManager`.
- Opens front camera and attempts to load effect (`effectPath` or `effects/TrollGrandma` fallback).

To use your own glasses effect:

1. Send `tryOn.effectPath` from backend (for example `effects/YourGlassesEffect`).
2. Ship effect resources under `android/app/src/main/assets/bnb-resources/effects/...`
3. Optionally pass `tryOn.resourcePaths` if resources are not in default path.
