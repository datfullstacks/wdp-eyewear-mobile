import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";

const EFFECTS_ROOT_URI = `${FileSystem.cacheDirectory || ""}banuba-runtime-effects/`;
const DEFAULT_ROTATION = "-90 0 0";
const DEFAULT_SCALE = "1 1 1";
const LEGACY_SAFE_SCALE = "0.1 0.1 0.1";
const DEFAULT_TRANSLATION = "0 0 0";
const DEFAULT_GRAVITY = "0 0 0";
const DEFAULT_CUT = "head";
const DEFAULT_SCENE = "effect wdp_runtime_tryon";
const LEGACY_ROTATION = "270 0 0";
const LEGACY_SCALE = "0.019 0.019 0.01";
const pendingRuntimeEffects = new Map();

const toText = (value) => String(value ?? "").trim();

const isLocalFileUri = (value) => /^file:\/\//i.test(toText(value));
const isGlbFile = (value) => /\.glb(\?|#|$)/i.test(toText(value));

const stripQueryAndHash = (value) => toText(value).replace(/[?#].*$/, "");

const getFileName = (value, fallbackName = "model.glb") => {
  const normalized = stripQueryAndHash(value);
  const segments = normalized.split("/");
  return segments[segments.length - 1] || fallbackName;
};

const normalizeVectorString = (value, fallbackValue) => {
  const text = toText(value);
  if (!text) return fallbackValue;

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(Number(part)))) {
    return fallbackValue;
  }

  return parts.join(" ");
};

const normalizeRuntimePrefabConfig = (prefabConfig) => {
  const normalizedRotation = normalizeVectorString(prefabConfig.rotation, DEFAULT_ROTATION);
  const normalizedScale = normalizeVectorString(prefabConfig.scale, DEFAULT_SCALE);
  const normalizedUsePhysics = Boolean(prefabConfig.usePhysics);
  const normalizedColliders = Array.isArray(prefabConfig.colliders) ? prefabConfig.colliders : [];
  const shouldDisablePhysicsWithoutColliders = normalizedUsePhysics && !normalizedColliders.length;
  const rotationWasLegacy = normalizedRotation === LEGACY_ROTATION;
  const scaleWasLegacy = normalizedScale === LEGACY_SCALE;
  const shouldDisableLegacyPhysics =
    (rotationWasLegacy || scaleWasLegacy) && normalizedUsePhysics && !normalizedColliders.length;
  const resolvedUsePhysics =
    shouldDisablePhysicsWithoutColliders || shouldDisableLegacyPhysics ? false : normalizedUsePhysics;
  const resolvedRotation = rotationWasLegacy ? DEFAULT_ROTATION : normalizedRotation;
  const resolvedScale = scaleWasLegacy ? LEGACY_SAFE_SCALE : normalizedScale;

  if (!rotationWasLegacy && !scaleWasLegacy && !shouldDisableLegacyPhysics && !shouldDisablePhysicsWithoutColliders) {
    return {
      ...prefabConfig,
      rotation: resolvedRotation,
      scale: resolvedScale,
      usePhysics: resolvedUsePhysics,
      colliders: normalizedColliders,
      normalizedFromLegacy: false,
    };
  }

  console.log(
    "[TryOn Native] Adjusting runtime prefab config for Banuba-safe GLTF defaults",
    JSON.stringify({
      originalRotation: prefabConfig.rotation,
      originalScale: prefabConfig.scale,
      originalUsePhysics: prefabConfig.usePhysics,
      resolvedRotation,
      resolvedScale,
      resolvedUsePhysics,
      disabledPhysicsWithoutColliders: shouldDisablePhysicsWithoutColliders,
    })
  );

  return {
    ...prefabConfig,
    rotation: resolvedRotation,
    scale: resolvedScale,
    usePhysics: resolvedUsePhysics,
    colliders: normalizedColliders,
    normalizedFromLegacy: rotationWasLegacy || scaleWasLegacy,
  };
};

const toNormalizedPrefabPayload = (prefabConfig = {}) => ({
  rotation: prefabConfig.rotation,
  scale: prefabConfig.scale,
  translation: prefabConfig.translation,
  gravity: prefabConfig.gravity,
  cut: prefabConfig.cut,
  usePhysics: Boolean(prefabConfig.usePhysics),
  colliders: Array.isArray(prefabConfig.colliders) ? prefabConfig.colliders : [],
});

const readPrefabConfig = (tryOn = {}) => {
  const prefab = tryOn?.prefab && typeof tryOn.prefab === "object" ? tryOn.prefab : {};
  const colliders = Array.isArray(prefab.colliders ?? tryOn.colliders)
    ? prefab.colliders ?? tryOn.colliders
    : [];

  return normalizeRuntimePrefabConfig({
    scene: toText(tryOn.scene) || DEFAULT_SCENE,
    rotation: prefab.rotation ?? tryOn.rotation ?? tryOn.modelRotation ?? tryOn.banubaRotation,
    scale: prefab.scale ?? tryOn.scale ?? tryOn.modelScale ?? tryOn.banubaScale,
    translation: normalizeVectorString(
      prefab.translation ?? tryOn.translation ?? tryOn.modelTranslation ?? tryOn.banubaTranslation,
      DEFAULT_TRANSLATION
    ),
    gravity: normalizeVectorString(prefab.gravity ?? tryOn.gravity, DEFAULT_GRAVITY),
    cut: toText(prefab.cut ?? tryOn.cut) || DEFAULT_CUT,
    usePhysics: Boolean(prefab.usePhysics ?? tryOn.usePhysics),
    colliders,
  });
};

async function ensureDirectory(uri) {
  if (!uri) return;
  try {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  } catch {
    // Directory may already exist.
  }
}

async function buildRuntimeEffectId({ productId, modelUri, prefabConfig }) {
  const seed = JSON.stringify({
    productId: toText(productId),
    modelUri: toText(modelUri),
    prefabConfig,
  });
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
}

function buildEffectConfig({ meshFileName, prefabConfig }) {
  return {
    scene: prefabConfig.scene,
    version: "2.0.0",
    camera: {},
    faces: [
      {
        gltf: {
          cut: prefabConfig.cut,
          "@use_physics": prefabConfig.usePhysics,
          "@mesh": `assets/${meshFileName}`,
          rotation: prefabConfig.rotation,
          scale: prefabConfig.scale,
          translation: prefabConfig.translation,
          gravity: prefabConfig.gravity,
          colliders: prefabConfig.colliders,
        },
      },
    ],
  };
}

async function writeJsonFile(uri, data) {
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function prepareBanubaRuntimeEffect({
  product = {},
  originalTryOn = {},
  cachedTryOn = {},
} = {}) {
  const existingEffectPath = toText(cachedTryOn.effectPath || originalTryOn.effectPath || originalTryOn.effect);
  if (existingEffectPath && !/^https?:\/\//i.test(existingEffectPath)) {
    return {
      effectPath: existingEffectPath,
      resourcePaths: Array.isArray(cachedTryOn.resourcePaths) ? cachedTryOn.resourcePaths : [],
      runtimeEffectMeta: {
        generated: false,
        reason: "existing_local_effect",
      },
    };
  }

  const modelUri = toText(cachedTryOn.glbUrl);
  if (!isLocalFileUri(modelUri) || !isGlbFile(modelUri)) {
    return {
      effectPath: existingEffectPath,
      resourcePaths: Array.isArray(cachedTryOn.resourcePaths) ? cachedTryOn.resourcePaths : [],
      runtimeEffectMeta: {
        generated: false,
        reason: "local_glb_unavailable",
      },
    };
  }

  await ensureDirectory(EFFECTS_ROOT_URI);

  const prefabConfig = readPrefabConfig({
    ...originalTryOn,
    ...cachedTryOn,
  });
  const runtimeEffectId = await buildRuntimeEffectId({
    productId: product.apiId || product.id,
    modelUri,
    prefabConfig,
  });

  const effectFolderName = `runtime-${runtimeEffectId.slice(0, 16)}`;
  const effectFolderUri = `${EFFECTS_ROOT_URI}${effectFolderName}/`;
  const assetsFolderUri = `${effectFolderUri}assets/`;
  const meshFileName = getFileName(modelUri, "model.glb");
  const effectModelUri = `${assetsFolderUri}${meshFileName}`;
  const effectConfigUri = `${effectFolderUri}config.json`;
  const effectMetaUri = `${effectFolderUri}wdp-runtime-effect.json`;
  const pendingKey = effectFolderName;

  if (pendingRuntimeEffects.has(pendingKey)) {
    return pendingRuntimeEffects.get(pendingKey);
  }

  const resourcePaths = Array.isArray(cachedTryOn.resourcePaths)
    ? cachedTryOn.resourcePaths.map((it) => toText(it)).filter(Boolean)
    : [];
  const generationPromise = (async () => {
    const modelInfo = await FileSystem.getInfoAsync(modelUri);
    if (!modelInfo.exists || !modelInfo.size || modelInfo.size <= 0) {
      return {
        effectPath: existingEffectPath,
        resourcePaths,
        runtimeEffectMeta: {
          generated: false,
          reason: "local_glb_missing_or_empty",
        },
      };
    }

    await FileSystem.deleteAsync(effectFolderUri, { idempotent: true });
    await ensureDirectory(effectFolderUri);
    await ensureDirectory(assetsFolderUri);

    try {
      await FileSystem.copyAsync({
        from: modelUri,
        to: effectModelUri,
      });
    } catch (error) {
      console.warn(`[TryOn Native] Runtime effect copy failed: ${error?.message || error}`);
      return {
        effectPath: existingEffectPath,
        resourcePaths,
        runtimeEffectMeta: {
          generated: false,
          reason: "runtime_copy_failed",
          error: error?.message || String(error),
        },
      };
    }

    const copiedInfo = await FileSystem.getInfoAsync(effectModelUri);
    if (!copiedInfo.exists || !copiedInfo.size || copiedInfo.size <= 0) {
      return {
        effectPath: existingEffectPath,
        resourcePaths,
        runtimeEffectMeta: {
          generated: false,
          reason: "runtime_copy_empty",
        },
      };
    }

    await writeJsonFile(
      effectConfigUri,
      buildEffectConfig({
        meshFileName,
        prefabConfig,
      })
    );
    await writeJsonFile(effectMetaUri, {
      productId: toText(product.apiId || product.id),
      sourceModelUri: modelUri,
      prefabConfig,
    });

    return {
      effectPath: effectFolderName,
      resourcePaths: Array.from(new Set([EFFECTS_ROOT_URI, ...resourcePaths])),
      resolvedPrefab: toNormalizedPrefabPayload(prefabConfig),
      runtimeEffectMeta: {
        generated: true,
        effectFolderName,
        effectFolderUri,
        effectModelUri,
        prefabConfig,
        normalizedFromLegacy: Boolean(prefabConfig.normalizedFromLegacy),
      },
    };
  })();

  pendingRuntimeEffects.set(pendingKey, generationPromise);
  try {
    return await generationPromise;
  } finally {
    pendingRuntimeEffects.delete(pendingKey);
  }
}
