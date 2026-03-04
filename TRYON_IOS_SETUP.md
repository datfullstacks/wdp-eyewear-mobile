# Banuba Try-On iOS (TestFlight)

This project uses a React Native bridge module named `WdpTryOnSdk` for native iOS try-on.

## 1) Required values

Set these environment variables in EAS (or locally before build):

- `BANUBA_ENABLED=true`
- `BANUBA_IOS_POD_NAME=BanubaSDK`
- `BANUBA_IOS_SDK_VERSION=1.17.+`
- `BANUBA_IOS_PODSPEC_SOURCE=<your Banuba podspec source>`
- `EXPO_PUBLIC_TRYON_PREFER_NATIVE=true`
- `EXPO_PUBLIC_TRYON_API_KEY=<your Banuba client token>`

Notes:

- `EXPO_PUBLIC_TRYON_API_KEY` is passed to native payload as `sdkKey`.
- `BANUBA_IOS_PODSPEC_SOURCE` depends on your Banuba account/license setup.

## 2) Build with EAS

```bash
npx eas login
npx eas build -p ios --profile production
```

After build succeeds:

```bash
npx eas submit -p ios --profile production --latest
```

## 3) Runtime behavior

- Product Detail (FRAME) shows `Virtual Try-On`.
- Tapping `Mở Try-On` navigates to native session screen.
- If native module is unavailable, JS fallback path remains available (web session URL/fallback URL).

## 4) Troubleshooting

- `E_BANUBA_NOT_LINKED`: pod/spec source not installed in iOS build.
- `E_MISSING_TOKEN`: `EXPO_PUBLIC_TRYON_API_KEY` is empty.
- If pod install fails, verify `BANUBA_IOS_PODSPEC_SOURCE` and `BANUBA_IOS_SDK_VERSION`.
