import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const MODEL_FILE_PATTERN = /\.(glb|gltf|usdz)(\?|#|$)/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

const CACHE_ENABLED = toBoolean(process.env.EXPO_PUBLIC_TRYON_CACHE_3D_ENABLED, true);
const CACHE_MAX_AGE_HOURS = toPositiveNumber(process.env.EXPO_PUBLIC_TRYON_CACHE_3D_MAX_AGE_HOURS, 168);
const CACHE_DIR = `${FileSystem.cacheDirectory || ""}tryon-3d/`;
const pendingDownloads = new Map();

function toText(value) {
  return String(value ?? "").trim();
}

function toBoolean(value, defaultValue = false) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return defaultValue;
  return TRUE_VALUES.has(normalized);
}

function toPositiveNumber(value, defaultValue) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

function isHttpUrl(value) {
  return HTTP_URL_PATTERN.test(toText(value));
}

function isModelFileUrl(value) {
  return MODEL_FILE_PATTERN.test(toText(value));
}

function canCacheModelUrl(value) {
  return isHttpUrl(value) && isModelFileUrl(value);
}

function inferModelExtension(url) {
  const normalized = toText(url).toLowerCase();
  if (normalized.includes(".usdz")) return ".usdz";
  if (normalized.includes(".gltf")) return ".gltf";
  return ".glb";
}

function cacheAgeMs() {
  return CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;
}

async function ensureCacheDirectory() {
  if (!CACHE_DIR) return;
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  } catch {
    // Ignore if folder already exists.
  }
}

async function buildCachePath(url) {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, toText(url));
  return `${CACHE_DIR}${hash}${inferModelExtension(url)}`;
}

function isExpired(modificationTimeSeconds) {
  if (!Number.isFinite(modificationTimeSeconds) || modificationTimeSeconds <= 0) return false;
  const updatedMs = modificationTimeSeconds * 1000;
  return Date.now() - updatedMs > cacheAgeMs();
}

async function resolveCachedPath(url) {
  if (!canCacheModelUrl(url) || !CACHE_DIR) return "";

  await ensureCacheDirectory();
  const path = await buildCachePath(url);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return "";

  if (isExpired(info.modificationTime)) {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch {
      // Ignore delete failure; stale file can still be used as fallback.
    }
    return "";
  }

  console.log(`[TryOn Cache] Reusing cached model: ${path}`);
  return path;
}

async function downloadModelToCache(url) {
  if (!canCacheModelUrl(url) || !CACHE_DIR) return "";

  await ensureCacheDirectory();
  const finalPath = await buildCachePath(url);
  const pendingKey = finalPath;

  if (pendingDownloads.has(pendingKey)) {
    return pendingDownloads.get(pendingKey);
  }

  const downloadPromise = (async () => {
    const tempPath = `${finalPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const result = await FileSystem.downloadAsync(url, tempPath);
      if (result.status !== 200) {
        throw new Error(`Download failed with status ${result.status}`);
      }

      const tempInfo = await FileSystem.getInfoAsync(tempPath);
      if (!tempInfo.exists || !tempInfo.size || tempInfo.size <= 0) {
        throw new Error("Downloaded model is empty");
      }

      try {
        await FileSystem.deleteAsync(finalPath, { idempotent: true });
      } catch {
        // Ignore missing target file.
      }

      try {
        await FileSystem.moveAsync({ from: tempPath, to: finalPath });
      } catch (moveError) {
        const finalInfo = await FileSystem.getInfoAsync(finalPath);
        if (!finalInfo.exists || !finalInfo.size || finalInfo.size <= 0) {
          throw moveError;
        }
      }

      console.log(`[TryOn Cache] Downloaded model to cache: ${finalPath}`);
      return finalPath;
    } finally {
      try {
        const tempInfo = await FileSystem.getInfoAsync(tempPath);
        if (tempInfo.exists) {
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
        }
      } catch {
        // Ignore temp cleanup errors.
      }
    }
  })();

  pendingDownloads.set(pendingKey, downloadPromise);
  try {
    return await downloadPromise;
  } finally {
    pendingDownloads.delete(pendingKey);
  }
}

async function resolveModelUrl(url) {
  const original = toText(url);
  if (!CACHE_ENABLED || !canCacheModelUrl(original)) {
    return {
      original,
      resolved: original,
      cached: false,
      cachePath: "",
    };
  }

  try {
    const existingPath = await resolveCachedPath(original);
    if (existingPath) {
      return {
        original,
        resolved: existingPath,
        cached: true,
        cachePath: existingPath,
      };
    }

    const downloadedPath = await downloadModelToCache(original);
    if (downloadedPath) {
      return {
        original,
        resolved: downloadedPath,
        cached: true,
        cachePath: downloadedPath,
      };
    }
  } catch (error) {
    console.warn(`[TryOn Cache] Failed caching model: ${original} (${error?.message || error})`);
  }

  return {
    original,
    resolved: original,
    cached: false,
    cachePath: "",
  };
}

function mapLaunchUrl(originalLaunchUrl, arResult, glbResult, usdzResult) {
  const launch = toText(originalLaunchUrl);
  if (!launch) return "";

  if (launch === arResult.original && arResult.resolved) return arResult.resolved;
  if (launch === glbResult.original && glbResult.resolved) return glbResult.resolved;
  if (launch === usdzResult.original && usdzResult.resolved) return usdzResult.resolved;
  return launch;
}

export async function prepareTryOnModelCache(tryOn = {}) {
  const originalAr = toText(tryOn.arUrl);
  const originalGlb = toText(tryOn.glbUrl);
  const originalUsdz = toText(tryOn.usdzUrl);
  const originalLaunch = toText(tryOn.launchUrl);

  const [arResult, glbResult, usdzResult] = await Promise.all([
    resolveModelUrl(originalAr),
    resolveModelUrl(originalGlb),
    resolveModelUrl(originalUsdz),
  ]);

  const launchUrl = mapLaunchUrl(originalLaunch, arResult, glbResult, usdzResult);

  return {
    ...tryOn,
    arUrl: arResult.resolved || originalAr,
    glbUrl: glbResult.resolved || originalGlb,
    usdzUrl: usdzResult.resolved || originalUsdz,
    launchUrl: launchUrl || originalLaunch,
    cacheMeta: {
      enabled: CACHE_ENABLED,
      ar: arResult,
      glb: glbResult,
      usdz: usdzResult,
    },
  };
}

export async function warmTryOnModelCache(tryOn = {}) {
  await prepareTryOnModelCache(tryOn);
}
