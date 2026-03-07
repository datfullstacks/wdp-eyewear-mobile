# Banuba Try-On Android Setup

This project now has a complete Android native launcher flow:

- React Native -> `WdpTryOnSdk` module
- `WdpTryOnSdk` -> `WdpTryOnActivity`
- `WdpTryOnActivity` -> Banuba native session (camera + render + load effect)

## 1) Required env vars

Set these values before building Android:

- `BANUBA_ENABLED=true`
- `BANUBA_ANDROID_MAVEN_URL=https://nexus.banuba.net/repository/maven-releases`
- `EXPO_PUBLIC_TRYON_PREFER_NATIVE=true`
- `EXPO_PUBLIC_TRYON_NATIVE_MODULE=WdpTryOnSdk`
- `EXPO_PUBLIC_TRYON_API_KEY=<Banuba client token>`

Important:

- Banuba `1.17.7` requires Android `minSdk >= 26`.
- Gradle now auto-raises minSdk to 26 when `BANUBA_ENABLED=true`.

Dependency options:

1. All-in-one package (simple, larger APK)
- `BANUBA_ANDROID_SDK_DEPENDENCY=com.banuba.sdk:banuba_sdk:1.17.7`

2. Minimal package mode for eyewear (lighter APK)
- `BANUBA_ANDROID_MINIMAL=true`
- `BANUBA_ANDROID_SDK_VERSION=1.17.7`

3. Explicit list mode (advanced, overrides minimal mode)
- `BANUBA_ANDROID_SDK_DEPENDENCIES=com.banuba.sdk:sdk_api:1.17.7,com.banuba.sdk:face_tracker:1.17.7`

Optional credentials for private Maven setup:

- `BANUBA_ANDROID_MAVEN_USERNAME=...`
- `BANUBA_ANDROID_MAVEN_PASSWORD=...`

## 2) Local effects folder (only for Banuba native effect mode)

If you use local effect paths (example: `effects/my_glasses`), put effect folders under:

- `<project_root>/effects`

Android Gradle now auto-copies this folder to:

- `android/app/src/main/assets/bnb-resources/effects`

before `preBuild`.

Important:

- If you run **Banuba native camera session**, `effectPath` is still required.
- `glbUrl/usdzUrl` are fallback/model links, not a Banuba effect replacement.

## 3) Build and run

```bash
npx expo run:android
```

If `android/` already exists and you changed plugin code, run prebuild once to sync:

```bash
npx expo prebuild --platform android
```

## 4) Try-on data requirements

`Try-On` button is enabled only when frontend computes `tryOn.ready = true`.

For backend product data, safe target is:

- `media.tryOn.status = "published"`
- `media.tryOn.enabled = true`
- `media.tryOn.assetIds` contains valid 3d assets
- have either:
  - local `effectPath` (for native Banuba), or
  - fallback/model URL (`arUrl`/`launchUrl`/`glbUrl`/`usdzUrl`)

Backend also validates publish rules for try-on assets.

## 5) API/Supabase-first flow (remote 3D -> local cache -> runtime Banuba effect)

If you want to avoid bundling local model files in app, use this flow:

1. Store `.glb/.gltf/.usdz` on Supabase Storage.
2. Save public/signed URLs in API data (`media.tryOn.glbUrl`, `media.tryOn.usdzUrl`, `media.tryOn.launchUrl`) or in Supabase table used by frontend merge.
3. Enable client cache:
   - `EXPO_PUBLIC_TRYON_CACHE_3D_ENABLED=true`
   - `EXPO_PUBLIC_TRYON_CACHE_3D_MAX_AGE_HOURS=168`
4. App will download remote models to `FileSystem.cacheDirectory/tryon-3d/`.
5. On Android native Banuba flow, local `.glb` is copied into a generated runtime effect folder under `FileSystem.cacheDirectory/banuba-runtime-effects/`.
6. App writes `config.json` for that runtime effect and loads the effect via Banuba `loadEffect(...)`.
7. Fallback links stay as external `http(s)` URLs. Local `.glb` cache is no longer treated as an external link to open directly.

Optional transform fields for generated runtime effect:

- `media.tryOn.rotation`
- `media.tryOn.scale`
- `media.tryOn.translation`

Supabase overlay also supports these aliases:

- `rotation`, `model_rotation`, `banuba_rotation`
- `scale`, `model_scale`, `banuba_scale`
- `translation`, `model_translation`, `banuba_translation`

## 6) Seed try-on data quickly

Use helper script:

- `scripts/seed-tryon-products.ps1`

Example:

```powershell
$env:BASE_URL = "https://lobster-app-7du3e.ondigitalocean.app"
$env:TOKEN = "<bearer token>"
$env:TRYON_EFFECT_PATH = "effects/test_TeethTone"
$env:DEMO_GLB_URL = "https://cdn.example.com/tryon/demo.glb"
$env:DEMO_USDZ_URL = "https://cdn.example.com/tryon/demo.usdz"

powershell -ExecutionPolicy Bypass -File .\scripts\seed-tryon-products.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\seed-tryon-products.ps1
```

What it does:

- fetches products
- targets `frame` and `sunglasses`
- ensures 3d glb/usdz assets exist (can inject demo URLs if provided)
- updates `media.tryOn` to `published + enabled + assetIds + (effectPath or fallback URLs)`

## 7) Common errors

- `E_MISSING_TOKEN`: `EXPO_PUBLIC_TRYON_API_KEY` is empty at build/runtime.
- `E_BANUBA_NOT_ENABLED`: `BANUBA_ENABLED` was not true during Android build.
- `E_BANUBA_NOT_LINKED`: dependency not resolved from Maven.
- `E_MISSING_EFFECT_PATH`: native mode has no local effect path and no valid fallback URL.

## 8) Notes on fallback logic

- `effectPath` is treated as local Banuba effect path (not URL).
- Android dynamic Banuba mode can synthesize a local effect from cached `.glb` even when backend only provides `glbUrl`.
- External fallback should be a real `http(s)` URL (web AR or viewer), not a raw local `.glb` file.
- Non-URL values like `effects/...` are treated as Banuba local effect paths.
