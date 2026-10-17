import { Platform } from "react-native";

const MODEL_FILE_PATTERN = /\.(glb|gltf|usdz)(\?|#|$)/i;
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const SDK_BASE_URL = process.env.EXPO_PUBLIC_TRYON_SDK_URL || "";
const SDK_PUBLIC_KEY = process.env.EXPO_PUBLIC_TRYON_API_KEY || "";

const toText = (value) => String(value ?? "").trim();

const canUseAbsoluteHttpUrl = (value) => ABSOLUTE_URL_PATTERN.test(toText(value));

const isModelFileUrl = (value) => MODEL_FILE_PATTERN.test(toText(value));
const isWebTryOnUrl = (value) => canUseAbsoluteHttpUrl(value) && !isModelFileUrl(value);

const appendQueryParams = (baseUrl, params) => {
  const pairs = Object.entries(params).filter(([, value]) => toText(value).length > 0);
  if (!pairs.length) return baseUrl;

  const query = pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(toText(value))}`)
    .join("&");

  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`;
};

export function getTryOnFallbackUrl(tryOn = {}) {
  const arUrl = toText(tryOn.arUrl);
  if (isWebTryOnUrl(arUrl)) return arUrl;

  const usdz = toText(tryOn.usdzUrl);
  const glb = toText(tryOn.glbUrl);
  const launch = toText(tryOn.launchUrl);

  const pickAbsolute = (...candidates) =>
    candidates.find((value) => canUseAbsoluteHttpUrl(value)) || "";
  const pickWeb = (...candidates) =>
    candidates.find((value) => isWebTryOnUrl(value)) || "";

  if (Platform.OS === "ios") {
    return pickAbsolute(usdz, launch, glb);
  }
  return pickWeb(launch);
}

export function buildTryOnSessionUrl({ product = {}, tryOn = {} } = {}) {
  const fallbackUrl = getTryOnFallbackUrl(tryOn);
  const backendArUrl = toText(tryOn.arUrl);
  const baseUrl = isWebTryOnUrl(backendArUrl) ? backendArUrl : toText(SDK_BASE_URL);

  if (!canUseAbsoluteHttpUrl(baseUrl)) {
    return { sessionUrl: "", fallbackUrl };
  }

  const baseIsModel = isModelFileUrl(baseUrl);
  if (baseIsModel) {
    return { sessionUrl: "", fallbackUrl: baseUrl };
  }

  const params = {
    sdkKey: SDK_PUBLIC_KEY,
    productId: product.apiId || product.id || "",
    productName: product.name || "",
    glb: tryOn.glbUrl || "",
    usdz: tryOn.usdzUrl || "",
    fallback: fallbackUrl,
  };

  return {
    sessionUrl: appendQueryParams(baseUrl, params),
    fallbackUrl,
  };
}

