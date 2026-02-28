import { NativeModules, Platform } from "react-native";

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
const toStringArray = (value) =>
  Array.isArray(value) ? value.map((it) => toText(it)).filter(Boolean) : [];

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
  const resolvedFallback = toText(fallbackUrl);
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
  const payload = buildNativeTryOnPayload({ product, tryOn, fallbackUrl });

  if (!payload.productId) {
    throw new Error("Native try-on requires productId");
  }

  const result = await module[startMethod](payload);
  return {
    moduleName,
    startMethod,
    payload,
    result: result ?? null,
  };
}
