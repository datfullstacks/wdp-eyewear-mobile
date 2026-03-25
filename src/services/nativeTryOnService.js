import { NativeModules, Platform } from "react-native";
import { prepareTryOnModelCache } from "./tryOnAssetCacheService";
import { prepareBanubaRuntimeEffect } from "./tryOnBanubaEffectService";

const DEFAULT_NATIVE_MODULE_NAME = "WdpTryOnSdk";
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const MAX_TRY_ON_MODELS = 8;

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
const shouldLogTryOnDebug = () =>
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  toBoolean(process.env.EXPO_PUBLIC_TRYON_DEBUG, false);

function logTryOnDebug(label, value) {
  if (!shouldLogTryOnDebug()) return;
  try {
    console.log(label, JSON.stringify(value, null, 2));
  } catch {
    console.log(label, value);
  }
}

function normalizePrefab(prefab = {}) {
  if (!prefab || typeof prefab !== "object" || Array.isArray(prefab)) return undefined;

  const normalized = {
    rotation: toText(prefab.rotation),
    scale: toText(prefab.scale),
    translation: toText(prefab.translation),
    gravity: toText(prefab.gravity),
    cut: toText(prefab.cut),
  };

  if (typeof prefab.usePhysics === "boolean") {
    normalized.usePhysics = prefab.usePhysics;
  }

  if (Array.isArray(prefab.colliders)) {
    normalized.colliders = prefab.colliders;
  }

  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === "") delete normalized[key];
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

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

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => toText(value))
        .filter(Boolean)
    )
  );
}

function mergeTryOnModel(baseTryOn = {}, model = {}, index = 0) {
  return {
    ...baseTryOn,
    ...model,
    id: toText(model?.id) || `model-${index + 1}`,
    label: toText(model?.label) || `Model ${index + 1}`,
    ready: Boolean(model?.ready ?? baseTryOn?.ready),
    arUrl: toText(model?.arUrl) || toText(baseTryOn?.arUrl),
    glbUrl: toText(model?.glbUrl) || toText(baseTryOn?.glbUrl),
    usdzUrl: toText(model?.usdzUrl) || toText(baseTryOn?.usdzUrl),
    launchUrl: toText(model?.launchUrl) || toText(baseTryOn?.launchUrl),
    effectPath:
      toText(model?.effectPath || model?.effect) ||
      toText(baseTryOn?.effectPath || baseTryOn?.effect),
    scene: toText(model?.scene) || toText(baseTryOn?.scene),
    resourcePaths:
      toStringArray(model?.resourcePaths).length > 0
        ? toStringArray(model?.resourcePaths)
        : toStringArray(baseTryOn?.resourcePaths),
    prefab:
      model?.prefab && typeof model.prefab === "object"
        ? model.prefab
        : baseTryOn?.prefab && typeof baseTryOn.prefab === "object"
          ? baseTryOn.prefab
          : undefined,
  };
}

async function prepareTryOnModelForNative({
  product = {},
  baseTryOn = {},
  model = {},
  index = 0,
  fallbackUrl = "",
} = {}) {
  const originalModel = mergeTryOnModel(baseTryOn, model, index);
  const cachedTryOn = await prepareTryOnModelCache(originalModel);
  const runtimeEffect = await prepareBanubaRuntimeEffect({
    product,
    originalTryOn: originalModel,
    cachedTryOn,
  });
  const preparedFallbackUrl = resolvePreparedFallbackUrl({
    fallbackUrl: fallbackUrl || originalModel.fallbackUrl || originalModel.launchUrl || originalModel.arUrl,
    originalTryOn: originalModel,
    preparedTryOn: cachedTryOn,
  });
  const resolvedEffectPath =
    toText(runtimeEffect?.effectPath) ||
    toText(originalModel.effectPath || originalModel.effect);
  const resourcePaths =
    runtimeEffect?.resourcePaths?.length
      ? runtimeEffect.resourcePaths
      : toStringArray(originalModel.resourcePaths);

  return {
    ...originalModel,
    arUrl: toText(cachedTryOn?.arUrl) || toText(originalModel.arUrl),
    glbUrl: toText(cachedTryOn?.glbUrl) || toText(originalModel.glbUrl),
    usdzUrl: toText(cachedTryOn?.usdzUrl) || toText(originalModel.usdzUrl),
    launchUrl: toText(cachedTryOn?.launchUrl) || toText(originalModel.launchUrl),
    effectPath: resolvedEffectPath,
    resourcePaths,
    fallbackUrl: preparedFallbackUrl,
    ready: Boolean(originalModel.ready || resolvedEffectPath || preparedFallbackUrl),
    cacheMeta: cachedTryOn?.cacheMeta || null,
    runtimeEffectMeta: runtimeEffect?.runtimeEffectMeta || null,
  };
}

export function buildNativeTryOnPayload({ product = {}, tryOn = {}, fallbackUrl = "" } = {}) {
  const primaryArUrl = toText(tryOn.arUrl);
  const glbUrl = toText(tryOn.glbUrl);
  const usdzUrl = toText(tryOn.usdzUrl);
  const launchUrl = toText(tryOn.launchUrl);
  const effectPath = toText(tryOn.effectPath || tryOn.effect || "");
  const scene = toText(tryOn.scene);
  const prefab = normalizePrefab(tryOn.prefab);
  const resolvedFallback = canUseExternalFallbackUrl(fallbackUrl) ? toText(fallbackUrl) : "";
  const resourcePaths = toStringArray(tryOn.resourcePaths);
  const models = Array.isArray(tryOn.models)
    ? tryOn.models
        .slice(0, MAX_TRY_ON_MODELS)
        .map((model, index) => ({
          id: toText(model?.id) || `model-${index + 1}`,
          label: toText(model?.label) || `Model ${index + 1}`,
          ready: Boolean(model?.ready),
          glbUrl: toText(model?.glbUrl),
          usdzUrl: toText(model?.usdzUrl),
          arUrl: toText(model?.arUrl),
          launchUrl: toText(model?.launchUrl),
          effectPath: toText(model?.effectPath),
          scene: toText(model?.scene),
          fallbackUrl: toText(model?.fallbackUrl),
          resourcePaths: toStringArray(model?.resourcePaths),
          prefab: normalizePrefab(model?.prefab),
        }))
        .filter(
          (model) =>
            model.ready ||
            model.glbUrl ||
            model.usdzUrl ||
            model.arUrl ||
            model.launchUrl ||
            model.effectPath ||
            model.fallbackUrl
        )
    : [];

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
    selectedModelId: toText(tryOn.selectedModelId),
    arUrl: canUseAbsoluteHttpUrl(primaryArUrl) ? primaryArUrl : "",
    launchUrl:
      Platform.OS === "ios"
        ? (canUseOpenableUrl(launchUrl) ? launchUrl : "")
        : (isWebFallbackUrl(launchUrl) ? launchUrl : ""),
    effectPath: resolvedEffectPath,
    scene,
    resourcePaths,
    modelUrl,
    glbUrl,
    usdzUrl,
    fallbackUrl: resolvedFallback,
    assetIds: Array.isArray(tryOn.assetIds) ? tryOn.assetIds.map((id) => toText(id)).filter(Boolean) : [],
    models,
    ...(prefab ? { prefab } : {}),
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
  const originalModels = Array.isArray(originalTryOn.models)
    ? originalTryOn.models.slice(0, MAX_TRY_ON_MODELS)
    : [];
  const preparedModels = originalModels.length
    ? await Promise.all(
        originalModels.map((model, index) =>
          prepareTryOnModelForNative({
            product,
            baseTryOn: originalTryOn,
            model,
            index,
            fallbackUrl,
          })
        )
      )
    : [];
  const selectedModelId = toText(originalTryOn.selectedModelId);
  const selectedPreparedModel =
    (selectedModelId
      ? preparedModels.find((model) => toText(model.id) === selectedModelId)
      : null) ||
    preparedModels.find((model) => model.ready) ||
    null;

  let activePreparedTryOn = selectedPreparedModel;
  let primaryCacheMeta = selectedPreparedModel?.cacheMeta || null;
  let primaryRuntimeEffectMeta = selectedPreparedModel?.runtimeEffectMeta || null;

  if (!activePreparedTryOn) {
    activePreparedTryOn = await prepareTryOnModelForNative({
      product,
      baseTryOn: originalTryOn,
      model: originalTryOn,
      fallbackUrl,
    });
    primaryCacheMeta = activePreparedTryOn?.cacheMeta || null;
    primaryRuntimeEffectMeta = activePreparedTryOn?.runtimeEffectMeta || null;
  }

  const preparedFallbackUrl =
    toText(activePreparedTryOn?.fallbackUrl) ||
    resolvePreparedFallbackUrl({
      fallbackUrl,
      originalTryOn,
      preparedTryOn: activePreparedTryOn || originalTryOn,
    });
  const resolvedEffectPath = toText(activePreparedTryOn?.effectPath);

  if (!resolvedEffectPath && !preparedFallbackUrl) {
    const runtimeReason = toText(primaryRuntimeEffectMeta?.reason);
    if (runtimeReason === "local_glb_unavailable") {
      throw new Error(
        "Try-on model was not cached locally. Restart Metro with --clear and try again."
      );
    }

    throw new Error("Native try-on requires a local Banuba effect or a cached local GLB model.");
  }

  const payloadTryOn = {
    ...originalTryOn,
    ...activePreparedTryOn,
    selectedModelId: toText(activePreparedTryOn?.id || selectedModelId),
    models: preparedModels.map((model) => ({
      id: model.id,
      label: model.label,
      ready: Boolean(model.ready),
      glbUrl: toText(model.glbUrl),
      usdzUrl: toText(model.usdzUrl),
      arUrl: toText(model.arUrl),
      launchUrl: toText(model.launchUrl),
      effectPath: toText(model.effectPath),
      scene: toText(model.scene),
      fallbackUrl: toText(model.fallbackUrl),
      resourcePaths: toStringArray(model.resourcePaths),
      prefab: normalizePrefab(model.prefab),
    })),
    resourcePaths: uniqueStrings([
      toStringArray(activePreparedTryOn?.resourcePaths),
      toStringArray(originalTryOn.resourcePaths),
      ...preparedModels.map((model) => toStringArray(model.resourcePaths)),
    ]),
  };
  const payload = buildNativeTryOnPayload({
    product,
    tryOn: payloadTryOn,
    fallbackUrl: preparedFallbackUrl,
  });

  logTryOnDebug("[TryOn Native] Prepared tryOn config", payloadTryOn);
  logTryOnDebug("[TryOn Native] Bridge payload", payload);

  if (!payload.productId) {
    throw new Error("Native try-on requires productId");
  }

  const result = await module[startMethod](payload);
  console.log("[TryOn Native] Session result", {
    moduleName,
    startMethod,
    result,
    cacheMeta: primaryCacheMeta,
    runtimeEffectMeta: primaryRuntimeEffectMeta,
    preparedModelCount: preparedModels.length,
  });
  return {
    moduleName,
    startMethod,
    payload,
    cacheMeta: primaryCacheMeta,
    runtimeEffectMeta: primaryRuntimeEffectMeta,
    preparedModels: preparedModels.map((model) => ({
      id: model.id,
      label: model.label,
      effectPath: model.effectPath,
      ready: model.ready,
    })),
    result: result ?? null,
  };
}
