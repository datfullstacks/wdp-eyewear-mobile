import { supabase } from "./supabaseClient";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function toText(value) {
  return String(value ?? "").trim();
}

function toBoolean(value, defaultValue = false) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return defaultValue;
  return TRUE_VALUES.has(normalized);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function readField(row, keys = []) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return undefined;
}

const TRYON_SUPABASE_ENABLED = toBoolean(process.env.EXPO_PUBLIC_TRYON_SUPABASE_ENABLED, false);
const TRYON_SUPABASE_TABLE =
  toText(process.env.EXPO_PUBLIC_TRYON_SUPABASE_TABLE) || "product_tryon_assets";
const TRYON_SUPABASE_PRODUCT_ID_COLUMN =
  toText(process.env.EXPO_PUBLIC_TRYON_SUPABASE_PRODUCT_ID_COLUMN) || "product_id";

function normalizeTryOnRow(row = {}) {
  const productId = toText(readField(row, [TRYON_SUPABASE_PRODUCT_ID_COLUMN, "productId", "product_id"]));
  const enabledRaw = readField(row, ["enabled", "is_enabled"]);
  const publishedRaw = readField(row, ["published", "is_published"]);
  const isActiveRaw = readField(row, ["is_active", "active", "isActive"]);

  const enabled =
    enabledRaw == null ? null : typeof enabledRaw === "boolean" ? enabledRaw : toBoolean(enabledRaw, false);
  const published =
    publishedRaw == null
      ? null
      : typeof publishedRaw === "boolean"
      ? publishedRaw
      : toBoolean(publishedRaw, false);
  const isActive =
    isActiveRaw == null
      ? true
      : typeof isActiveRaw === "boolean"
      ? isActiveRaw
      : toBoolean(isActiveRaw, true);

  const status = toText(readField(row, ["status"]));
  const arUrl = toText(readField(row, ["ar_url", "arUrl", "web_url", "webUrl"]));
  const glbUrl = toText(readField(row, ["glb_url", "glbUrl", "model_url", "modelUrl"]));
  const usdzUrl = toText(readField(row, ["usdz_url", "usdzUrl"]));
  const launchUrl = toText(readField(row, ["launch_url", "launchUrl"]));
  const effectPath = toText(readField(row, ["effect_path", "effectPath", "effect"]));
  const rotation = toText(readField(row, ["rotation", "model_rotation", "modelRotation", "banuba_rotation", "banubaRotation"]));
  const scale = toText(readField(row, ["scale", "model_scale", "modelScale", "banuba_scale", "banubaScale"]));
  const translation = toText(
    readField(row, [
      "translation",
      "model_translation",
      "modelTranslation",
      "banuba_translation",
      "banubaTranslation",
    ])
  );
  const resourcePaths = normalizeStringArray(readField(row, ["resource_paths", "resourcePaths"]));
  const assetIds = normalizeStringArray(readField(row, ["asset_ids", "assetIds"]));
  const updatedAt = toText(readField(row, ["updated_at", "updatedAt", "created_at", "createdAt"]));

  return {
    productId,
    enabled,
    published,
    isActive,
    status,
    arUrl,
    glbUrl,
    usdzUrl,
    launchUrl,
    effectPath,
    rotation,
    scale,
    translation,
    resourcePaths,
    assetIds,
    updatedAt,
  };
}

function shouldReplaceRow(nextRow, prevRow) {
  if (!prevRow) return true;
  if (nextRow.isActive && !prevRow.isActive) return true;
  if (!nextRow.isActive && prevRow.isActive) return false;

  const nextTime = Date.parse(nextRow.updatedAt || "");
  const prevTime = Date.parse(prevRow.updatedAt || "");
  if (Number.isFinite(nextTime) && Number.isFinite(prevTime)) {
    return nextTime > prevTime;
  }
  return false;
}

async function fetchTryOnRowsByProductIds(productIds = []) {
  if (!TRYON_SUPABASE_ENABLED) return [];
  const ids = Array.from(new Set(productIds.map((id) => toText(id)).filter(Boolean)));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from(TRYON_SUPABASE_TABLE)
    .select("*")
    .in(TRYON_SUPABASE_PRODUCT_ID_COLUMN, ids);

  if (error) {
    console.warn(`[TryOn Supabase] Query failed on table "${TRYON_SUPABASE_TABLE}": ${error.message}`);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function patchProductWithTryOnRow(product = {}, row = null) {
  if (!row) return product;

  const media = product?.media && typeof product.media === "object" ? { ...product.media } : {};
  const currentTryOn =
    media?.tryOn && typeof media.tryOn === "object" ? { ...media.tryOn } : {};

  const nextTryOn = {
    ...currentTryOn,
    enabled: row.enabled ?? currentTryOn.enabled ?? Boolean(row.glbUrl || row.usdzUrl || row.arUrl),
    published:
      row.published ?? currentTryOn.published ?? (toText(row.status).toLowerCase() === "published"),
    status: row.status || currentTryOn.status || "published",
    arUrl: row.arUrl || currentTryOn.arUrl || "",
    glbUrl: row.glbUrl || currentTryOn.glbUrl || "",
    usdzUrl: row.usdzUrl || currentTryOn.usdzUrl || "",
    launchUrl: row.launchUrl || currentTryOn.launchUrl || "",
    effectPath: row.effectPath || currentTryOn.effectPath || currentTryOn.effect || "",
    scene: row.scene || currentTryOn.scene || "",
    prefab: {
      ...(currentTryOn.prefab && typeof currentTryOn.prefab === "object" ? currentTryOn.prefab : {}),
      ...(row.rotation ? { rotation: row.rotation } : {}),
      ...(row.scale ? { scale: row.scale } : {}),
      ...(row.translation ? { translation: row.translation } : {}),
      ...(row.gravity ? { gravity: row.gravity } : {}),
      ...(row.cut ? { cut: row.cut } : {}),
      ...(typeof row.usePhysics === "boolean" ? { usePhysics: row.usePhysics } : {}),
      ...(Array.isArray(row.colliders) ? { colliders: row.colliders } : {}),
    },
    resourcePaths:
      row.resourcePaths?.length ? row.resourcePaths : normalizeStringArray(currentTryOn.resourcePaths),
    assetIds: row.assetIds?.length ? row.assetIds : normalizeStringArray(currentTryOn.assetIds),
  };

  media.tryOn = nextTryOn;
  return { ...product, media };
}

export async function attachSupabaseTryOnToProducts(products = []) {
  if (!TRYON_SUPABASE_ENABLED || !Array.isArray(products) || !products.length) return products;

  const productIds = products
    .map((product) => toText(product?._id || product?.id))
    .filter(Boolean);
  if (!productIds.length) return products;

  const rows = await fetchTryOnRowsByProductIds(productIds);
  if (!rows.length) return products;

  const rowByProductId = new Map();
  rows.forEach((raw) => {
    const normalized = normalizeTryOnRow(raw);
    if (!normalized.productId) return;
    const prev = rowByProductId.get(normalized.productId);
    if (shouldReplaceRow(normalized, prev)) {
      rowByProductId.set(normalized.productId, normalized);
    }
  });

  return products.map((product) => {
    const key = toText(product?._id || product?.id);
    const row = rowByProductId.get(key);
    return patchProductWithTryOnRow(product, row);
  });
}
