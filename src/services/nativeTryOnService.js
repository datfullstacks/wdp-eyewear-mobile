import { NativeModules, Platform } from "react-native";
import { prepareTryOnModelCache } from "./tryOnAssetCacheService";
import { prepareBanubaRuntimeEffect } from "./tryOnBanubaEffectService";

const DEFAULT_NATIVE_MODULE_NAME = "WdpTryOnSdk";
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const toText = (value) => String(value ?? "").trim();

const toBoolean = (value, defaultValue = false) => {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return defaultValue;
  return TRUE_VALUES.has(normalized);
};

const getNativeModuleName = () =>
  toText(process.env.EXPO_PUBLIC_TRYON_NATIVE_MODULE) || DEFAULT_NATIVE_MODULE_NAME;

const getNativeModule = () => {
  const moduleName = getNativeModuleName();
  return {
    moduleName,
    module: NativeModules?.[moduleName] || null,
  };
};

const pickStartMethod = (module) => {
  if (!module) return null;
  if (typeof module.startTryOnSession === "function") return "startTryOnSession";
  if (typeof module.startSession === "function") return "startSession";
  if (typeof module.openTryOn === "function") return "openTryOn";
  return null;
};

const canUseAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(toText(value));
const canUseOpenableUrl = (value) => /^(https?:\/\/|file:\/\/|content:\/\/)/i.test(toText(value));
const isModelFileUrl = (value) => /\.(glb|gltf|usdz)(\?|#|$)/i.test(toText(value));
const isWebFallbackUrl = (value) => canUseAbsoluteHttpUrl(value) && !isModelFileUrl(value);
const canUseExternalFallbackUrl = (value) =>
  Platform.OS === "ios" ? canUseAbsoluteHttpUrl(value) : isWebFallbackUrl(value);
const toStringArray = (value) =>
  Array.isArray(value) ? value.map((it) => toText(it)).filter(Boolean) : [];

const pickExternalFallbackUrl = (tryOn = {}) =>
  Platform.OS === "ios"
    ? toText(tryOn.usdzUrl) || toText(tryOn.launchUrl) || toText(tryOn.glbUrl)
    : (isWebFallbackUrl(tryOn.arUrl) ? toText(tryOn.arUrl) : "") ||
      (isWebFallbackUrl(tryOn.launchUrl) ? toText(tryOn.launchUrl) : "");

function resolvePreparedFallbackUrl({
  fallbackUrl = "",
  originalTryOn = {},
  preparedTryOn = {},
} = {}) {
  const requested = toText(fallbackUrl);
  const original = {
    arUrl: toText(originalTryOn.arUrl),
    launchUrl: toText(originalTryOn.launchUrl),
    glbUrl: toText(originalTryOn.glbUrl),
    usdzUrl: toText(originalTryOn.usdzUrl),
  };
  const prepared = {
    arUrl: toText(preparedTryOn.arUrl),
    launchUrl: toText(preparedTryOn.launchUrl),
    glbUrl: toText(preparedTryOn.glbUrl),
    usdzUrl: toText(preparedTryOn.usdzUrl),
  };

  if (requested) {
    const replacements = [
      [original.arUrl, prepared.arUrl],
      [original.launchUrl, prepared.launchUrl],
      [original.glbUrl, prepared.glbUrl],
      [original.usdzUrl, prepared.usdzUrl],
    ];
    for (const [source, resolved] of replacements) {
      if (requested === source && canUseExternalFallbackUrl(resolved)) return resolved;
    }
    return canUseExternalFallbackUrl(requested) ? requested : "";
  }

  return pickExternalFallbackUrl(originalTryOn) || pickExternalFallbackUrl(preparedTryOn);
}

export function shouldPreferNativeTryOn() {
  return toBoolean(process.env.EXPO_PUBLIC_TRYON_PREFER_NATIVE, true);
}

export function getNativeTryOnAvailability() {
  const { moduleName, module } = getNativeModule();
  if (!module) {
    return {
      available: false,
      moduleName,
      reason: "Native module is not linked",
      startMethod: null,
    };
  }

  const startMethod = pickStartMethod(module);
  if (!startMethod) {
    return {
      available: false,
      moduleName,
      reason: "Native module does not expose a supported start method",
      startMethod: null,
    };
  }

  return {
    available: true,
    moduleName,
    reason: "",
    startMethod,
  };
}

export function buildNativeTryOnPayload({ product = {}, tryOn = {}, fallbackUrl = "" } = {}) {
  const primaryArUrl = toText(tryOn.arUrl);
  const glbUrl = toText(tryOn.glbUrl);
  const usdzUrl = toText(tryOn.usdzUrl);
  const launchUrl = toText(tryOn.launchUrl);
  const effectPath = toText(tryOn.effectPath || tryOn.effect || "");
  const resolvedFallback = canUseExternalFallbackUrl(fallbackUrl) ? toText(fallbackUrl) : "";
  const resourcePaths = toStringArray(tryOn.resourcePaths);

  const modelUrl =
    Platform.OS === "ios"
      ? usdzUrl || launchUrl || glbUrl
      : glbUrl || launchUrl || usdzUrl;

  const resolvedEffectPath =
    effectPath || (!canUseAbsoluteHttpUrl(primaryArUrl) ? primaryArUrl : "");

  return {
    sdkKey: toText(process.env.EXPO_PUBLIC_TRYON_API_KEY),
    productId: toText(product.apiId || product.id),
    productName: toText(product.name),
    status: toText(tryOn.status).toLowerCase(),
    published: Boolean(tryOn.published),
    ready: Boolean(tryOn.ready),
    arUrl: canUseAbsoluteHttpUrl(primaryArUrl) ? primaryArUrl : "",
    launchUrl:
      Platform.OS === "ios"
        ? (canUseOpenableUrl(launchUrl) ? launchUrl : "")
        : (isWebFallbackUrl(launchUrl) ? launchUrl : ""),
    effectPath: resolvedEffectPath,
    resourcePaths,
    modelUrl,
    glbUrl,
    usdzUrl,
    fallbackUrl: resolvedFallback,
    assetIds: Array.isArray(tryOn.assetIds) ? tryOn.assetIds.map((id) => toText(id)).filter(Boolean) : [],
    platform: Platform.OS,
  };
}

export async function startNativeTryOnSession({ product = {}, tryOn = {}, fallbackUrl = "" } = {}) {
  const availability = getNativeTryOnAvailability();
  if (!availability.available) {
    throw new Error(availability.reason || "Native try-on is unavailable");
  }

  const { moduleName, module } = getNativeModule();
  const startMethod = availability.startMethod;
  const originalTryOn = tryOn || {};
  const cachedTryOn = await prepareTryOnModelCache(originalTryOn);
  const runtimeEffect = await prepareBanubaRuntimeEffect({
    product,
    originalTryOn,
    cachedTryOn,
  });
  const preparedFallbackUrl = resolvePreparedFallbackUrl({
    fallbackUrl,
    originalTryOn,
    preparedTryOn: originalTryOn,
  });
  const resolvedEffectPath =
    runtimeEffect.effectPath || originalTryOn.effectPath || originalTryOn.effect || "";

  if (!toText(resolvedEffectPath)) {
    const runtimeReason = toText(runtimeEffect?.runtimeEffectMeta?.reason);
    if (runtimeReason === "local_glb_unavailable") {
      throw new Error(
        "Try-on model was not cached locally. Restart Metro with --clear and try again."
      );
    }

    throw new Error("Native try-on requires a local Banuba effect or a cached local GLB model.");
  }

  const payloadTryOn = {
    ...originalTryOn,
    effectPath: resolvedEffectPath,
    resourcePaths:
      runtimeEffect.resourcePaths?.length
        ? runtimeEffect.resourcePaths
        : toStringArray(originalTryOn.resourcePaths),
  };
  const payload = buildNativeTryOnPayload({
    product,
    tryOn: payloadTryOn,
    fallbackUrl: preparedFallbackUrl,
  });

  if (!payload.productId) {
    throw new Error("Native try-on requires productId");
  }

  const result = await module[startMethod](payload);
  console.log("[TryOn Native] Session result", {
    moduleName,
    startMethod,
    result,
    cacheMeta: cachedTryOn?.cacheMeta || null,
    runtimeEffectMeta: runtimeEffect?.runtimeEffectMeta || null,
  });
  return {
    moduleName,
    startMethod,
    payload,
    cacheMeta: cachedTryOn?.cacheMeta || null,
    runtimeEffectMeta: runtimeEffect?.runtimeEffectMeta || null,
    result: result ?? null,
  };
}
