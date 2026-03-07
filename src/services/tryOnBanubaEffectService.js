import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";

const EFFECTS_ROOT_URI = `${FileSystem.cacheDirectory || ""}banuba-runtime-effects/`;
const DEFAULT_ROTATION = "270 0 0";
const DEFAULT_SCALE = "0.019 0.019 0.01";
const DEFAULT_TRANSLATION = "0 0 0";
const DEFAULT_GRAVITY = "0 0 0";
const DEFAULT_CUT = "head";
const DEFAULT_SCENE = "effect wdp_runtime_tryon";

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

const readPrefabConfig = (tryOn = {}) => {
  const prefab = tryOn?.prefab && typeof tryOn.prefab === "object" ? tryOn.prefab : {};
  const colliders = Array.isArray(prefab.colliders ?? tryOn.colliders)
    ? prefab.colliders ?? tryOn.colliders
    : [];

  return {
    scene: toText(tryOn.scene) || DEFAULT_SCENE,
    rotation: normalizeVectorString(
      prefab.rotation ?? tryOn.rotation ?? tryOn.modelRotation ?? tryOn.banubaRotation,
      DEFAULT_ROTATION
    ),
    scale: normalizeVectorString(
      prefab.scale ?? tryOn.scale ?? tryOn.modelScale ?? tryOn.banubaScale,
      DEFAULT_SCALE
    ),
    translation: normalizeVectorString(
      prefab.translation ?? tryOn.translation ?? tryOn.modelTranslation ?? tryOn.banubaTranslation,
      DEFAULT_TRANSLATION
    ),
    gravity: normalizeVectorString(prefab.gravity ?? tryOn.gravity, DEFAULT_GRAVITY),
    cut: toText(prefab.cut ?? tryOn.cut) || DEFAULT_CUT,
    usePhysics: Boolean(prefab.usePhysics ?? tryOn.usePhysics),
    colliders,
  };
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

  await FileSystem.deleteAsync(effectFolderUri, { idempotent: true });
  await ensureDirectory(effectFolderUri);
  await ensureDirectory(assetsFolderUri);
  await FileSystem.copyAsync({
    from: modelUri,
    to: effectModelUri,
  });
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

  const resourcePaths = Array.isArray(cachedTryOn.resourcePaths)
    ? cachedTryOn.resourcePaths.map((it) => toText(it)).filter(Boolean)
    : [];

  return {
    effectPath: effectFolderName,
    resourcePaths: Array.from(new Set([EFFECTS_ROOT_URI, ...resourcePaths])),
    runtimeEffectMeta: {
      generated: true,
      effectFolderName,
      effectFolderUri,
      effectModelUri,
      prefabConfig,
    },
  };
}
