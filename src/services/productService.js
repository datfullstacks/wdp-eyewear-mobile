import { api } from "./apiClient";
import { attachSupabaseTryOnToProducts } from "./tryOnSupabaseService";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80";

const COLOR_HEX = {
  black: "#111111",
  "đen": "#111111",
  den: "#111111",
  white: "#FFFFFF",
  "trắng": "#FFFFFF",
  trang: "#FFFFFF",
  silver: "#9CA3AF",
  "bạc": "#9CA3AF",
  bac: "#9CA3AF",
  gold: "#C9A227",
  "vàng": "#C9A227",
  vang: "#C9A227",
  navy: "#374151",
  blue: "#2563EB",
  "xanh": "#2563EB",
  "xanh dương": "#2563EB",
  beige: "#D6C9B4",
  be: "#D6C9B4",
  brown: "#8B5E34",
  "nâu": "#8B5E34",
  nau: "#8B5E34",
  gray: "#9CA3AF",
  grey: "#9CA3AF",
  "xám": "#9CA3AF",
  xam: "#9CA3AF",
};

const STOCK_LABEL = {
  IN_STOCK: "Còn hàng",
  PREORDER: "Đặt trước",
  OUT_OF_STOCK: "Hết hàng",
};

const STATUS_LABEL = {
  IN_STOCK: "Có sẵn",
  PREORDER: "Đặt trước",
  OUT_OF_STOCK: "Hết hàng",
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const MODEL_FILE_PATTERN = /\.(glb|gltf|usdz)(\?|#|$)/i;

function toText(value) {
  return String(value ?? "").trim();
}

function toBoolean(value, defaultValue = false) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return defaultValue;
  return TRUE_VALUES.has(normalized);
}

function canUseAbsoluteHttpUrl(value) {
  return ABSOLUTE_URL_PATTERN.test(toText(value));
}

function isModelFileUrl(value) {
  return MODEL_FILE_PATTERN.test(toText(value));
}

function isWebTryOnUrl(value) {
  return canUseAbsoluteHttpUrl(value) && !isModelFileUrl(value);
}

function toCsvList(value) {
  return toText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const TRYON_FORCE_DEMO = toBoolean(process.env.EXPO_PUBLIC_TRYON_FORCE_DEMO, false);
const TRYON_DEMO_EFFECT_PATH =
  toText(process.env.EXPO_PUBLIC_TRYON_DEMO_EFFECT_PATH) || "effects/test_TeethTone";
const TRYON_DEMO_RESOURCE_PATHS = toCsvList(process.env.EXPO_PUBLIC_TRYON_DEMO_RESOURCE_PATHS);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIdString(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value._id != null) return toIdString(value._id);
    if (value.id != null) return toIdString(value.id);
    if (typeof value.toString === "function") {
      const text = String(value.toString());
      if (text && text !== "[object Object]") return text;
    }
  }
  return "";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toHex(name) {
  if (!name) return "#111827";
  const key = String(name).trim().toLowerCase();
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  if (key.startsWith("#") && (key.length === 4 || key.length === 7)) return key;
  return "#111827";
}

function normalizeAsset(asset = {}) {
  return {
    ...asset,
    id: toIdString(asset?._id || asset?.id),
    url: asset?.url || null,
    posterUrl: asset?.posterUrl || null,
    role: asset?.role || null,
    assetType: asset?.assetType || null,
    format: asset?.format || null,
    ar: asset?.ar || null,
    order: safeNumber(asset?.order) ?? 9999,
  };
}

function normalizeAssets(assets = []) {
  return assets
    .map((asset) => normalizeAsset(asset))
    .sort((a, b) => (a.order || 9999) - (b.order || 9999));
}

function pick2DAsset(assets = []) {
  return (
    assets.find((a) => a?.assetType === "2d" && a?.role === "hero") ||
    assets.find((a) => a?.assetType === "2d" && a?.role === "gallery") ||
    assets.find((a) => a?.assetType === "2d" && a?.role === "thumbnail") ||
    assets.find((a) => a?.assetType === "2d" && a?.role === "lifestyle") ||
    assets.find((a) => a?.assetType === "2d") ||
    null
  );
}

function pick3DAsset(assets = []) {
  return (
    assets.find((a) => a?.assetType === "3d" && a?.role === "viewer") ||
    assets.find((a) => a?.assetType === "3d" && a?.role === "try_on") ||
    assets.find((a) => a?.assetType === "3d") ||
    null
  );
}

function pickHeroImage(assets = []) {
  const hero2d =
    pick2DAsset(assets) ||
    assets.find((a) => a?.role === "hero") ||
    assets[0];

  return hero2d?.url || hero2d?.posterUrl || DEFAULT_IMAGE;
}

function computePricing(pricing = {}) {
  const basePrice = safeNumber(pricing.basePrice);
  const salePrice = safeNumber(pricing.salePrice);
  const msrp = safeNumber(pricing.msrp);

  const price = salePrice ?? basePrice ?? msrp ?? 0;

  let originalPrice = null;
  if (salePrice != null && basePrice != null && basePrice > salePrice) {
    originalPrice = basePrice;
  } else if (msrp != null && msrp > price) {
    originalPrice = msrp;
  }

  let discountPct = safeNumber(pricing.discountPercent);
  if (discountPct == null && originalPrice && originalPrice > price) {
    discountPct = Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  return {
    price,
    originalPrice,
    discountPct: discountPct || 0,
  };
}

// function computeStockStatus(product, totalStock) {
//   const statusRaw = String(product?.status || "").toLowerCase();
//   if (statusRaw === "out_of_stock") return "OUT_OF_STOCK";
//   if (statusRaw === "inactive") return "OUT_OF_STOCK";
//   if (statusRaw === "draft") return "PREORDER";

//   if (product?.inventory?.track && typeof totalStock === "number") {
//     if (totalStock <= 0) return "OUT_OF_STOCK";
//     return "IN_STOCK";
//   }

//   return "IN_STOCK";
// }

function computeStockStatus(product, totalStock) {
  const statusRaw = String(product?.status || "").toLowerCase();

  // ✅ nếu preOrder.enabled true và hết hàng => PREORDER
  const preorderEnabled = product?.preOrder?.enabled === true;

  if (product?.inventory?.track && typeof totalStock === "number") {
    if (totalStock <= 0) return preorderEnabled ? "PREORDER" : "OUT_OF_STOCK";
    return "IN_STOCK";
  }

  // fallback theo status cũ
  if (statusRaw === "out_of_stock" || statusRaw === "inactive") {
    return preorderEnabled ? "PREORDER" : "OUT_OF_STOCK";
  }

  return "IN_STOCK";
}

function normalizeType(apiType) {
  const t = String(apiType || "").toLowerCase();
  if (t === "lens" || t === "contact_lens") return "LENS";
  if (t === "frame" || t === "sunglasses") return "FRAME";
  return "OTHER";
}

function buildSpecsList(product) {
  const out = [];
  const add = (label, value) => {
    if (value == null || value === "") return;
    out.push({ label, value: String(value) });
  };

  const specs = product?.specs || {};
  const common = specs.common || {};
  const frame = specs.frame || {};
  const dimensions = specs.dimensions || {};
  const lens = specs.lens || {};
  const accessory = specs.accessory || {};

  add("Chất liệu", frame.material || lens.material || accessory.material);
  add("Hình dáng", common.shape);
  if (dimensions.frameWidthMm) add("Độ rộng", `${dimensions.frameWidthMm}mm`);
  if (dimensions.templeLengthMm) add("Chiều dài càng", `${dimensions.templeLengthMm}mm`);
  if (dimensions.bridgeMm) add("Cầu kính", `${dimensions.bridgeMm}mm`);
  if (dimensions.lensWidthMm) add("Chiều rộng tròng", `${dimensions.lensWidthMm}mm`);
  if (dimensions.lensHeightMm) add("Chiều cao tròng", `${dimensions.lensHeightMm}mm`);
  if (common.weightGram) add("Trọng lượng", `${common.weightGram}g`);
  if (lens.uvProtection) add("UV", lens.uvProtection);
  if (typeof lens.polarized === "boolean") add("Polarized", lens.polarized ? "Có" : "Không");
  if (typeof lens.blueLightFilter === "boolean")
    add("Chống ánh xanh", lens.blueLightFilter ? "Có" : "Không");
  if (lens.index) add("Chỉ số chiết suất", lens.index);
  if (lens.lensType) add("Loại tròng", lens.lensType);

  return out.slice(0, 6);
}

function buildVariantAssetMap(variants = [], assets = []) {
  const assetById = new Map(
    assets
      .map((asset) => [toIdString(asset?.id || asset?._id), asset])
      .filter((entry) => Boolean(entry[0] && entry[1]))
  );

  const byVariant = {};
  variants.forEach((variant) => {
    const variantId = toIdString(variant?._id || variant?.id);
    if (!variantId) return;
    const ids = Array.isArray(variant?.assetIds) ? variant.assetIds : [];
    const matchedAssets = ids
      .map((assetId) => assetById.get(toIdString(assetId)))
      .filter(Boolean);
    byVariant[variantId] = matchedAssets;
  });

  return byVariant;
}

function buildVariantsMeta(variants = [], assets = [], variantAssetsById = {}) {
  const colors = uniq(variants.map((v) => v?.options?.color));
  const sizes = uniq(variants.map((v) => v?.options?.size).map((s) => (s != null ? String(s) : null)));

  const colorToImage = new Map();
  variants.forEach((v) => {
    const color = v?.options?.color;
    const variantId = toIdString(v?._id || v?.id);
    if (!color || !variantId) return;

    const variantAssets = Array.isArray(variantAssetsById[variantId])
      ? variantAssetsById[variantId]
      : [];
    const picked =
      pick2DAsset(variantAssets) ||
      pick2DAsset(
        assets.filter((asset) => {
          if (asset?.assetType !== "2d") return false;
          if (asset?.role === "hero") return true;
          return asset?.role === "gallery";
        })
      );

    const url = picked?.url || picked?.posterUrl || null;
    if (url && !colorToImage.has(color)) colorToImage.set(color, url);
  });

  const colorsMeta = colors.map((name) => ({
    id: slugify(name) || String(name),
    name: String(name),
    hex: toHex(name),
    imageOverride: colorToImage.get(name) || null,
  }));

  return {
    colors: colorsMeta,
    sizes,
    colorDots: colorsMeta.map((c) => c.hex),
  };
}

function buildShipping(fulfillment = {}) {
  if (fulfillment?.leadTime) {
    const lead = String(fulfillment.leadTime).replace("d", " ngày");
    return { etaLabel: `Giao dự kiến ${lead}` };
  }
  return { etaLabel: "Giao nhanh 1–3 ngày" };
}

function buildTryOnMeta(media = {}) {
  const assets = Array.isArray(media?.assets) ? media.assets : [];
  const tryOn = media?.tryOn || {};

  const status = String(tryOn?.status || "").trim().toLowerCase();
  const arUrl = String(tryOn?.arUrl || "").trim();
  const directGlbUrl = String(tryOn?.glbUrl || "").trim();
  const directUsdzUrl = String(tryOn?.usdzUrl || "").trim();
  const directLaunchUrl = String(tryOn?.launchUrl || "").trim();
  const effectPath = String(tryOn?.effectPath || tryOn?.effect || "").trim();
  const scene = String(tryOn?.scene || "").trim();
  const rotation = String(
    tryOn?.prefab?.rotation ?? tryOn?.rotation ?? tryOn?.modelRotation ?? tryOn?.banubaRotation ?? ""
  ).trim();
  const scale = String(
    tryOn?.prefab?.scale ?? tryOn?.scale ?? tryOn?.modelScale ?? tryOn?.banubaScale ?? ""
  ).trim();
  const translation = String(
    tryOn?.prefab?.translation ??
    tryOn?.translation ??
    tryOn?.modelTranslation ??
    tryOn?.banubaTranslation ??
    ""
  ).trim();
  const gravity = String(tryOn?.prefab?.gravity ?? tryOn?.gravity ?? "").trim();
  const cut = String(tryOn?.prefab?.cut ?? tryOn?.cut ?? "").trim();
  const usePhysics =
    typeof tryOn?.prefab?.usePhysics === "boolean"
      ? tryOn.prefab.usePhysics
      : typeof tryOn?.usePhysics === "boolean"
        ? tryOn.usePhysics
        : undefined;
  const colliders = Array.isArray(tryOn?.prefab?.colliders)
    ? tryOn.prefab.colliders
    : Array.isArray(tryOn?.colliders)
      ? tryOn.colliders
      : [];

  const hasDirectLaunch = Boolean(arUrl || directGlbUrl || directUsdzUrl || directLaunchUrl || effectPath);
  const enabled =
    typeof tryOn?.enabled === "boolean"
      ? tryOn.enabled
      : status === "published" || hasDirectLaunch;
  const published = status === "published" && enabled;
  const configuredAssetIds = Array.isArray(tryOn?.assetIds) ? tryOn.assetIds : [];
  const configuredAssetIdSet = new Set(
    configuredAssetIds.map((id) => String(id || "").trim()).filter(Boolean)
  );

  const configuredAssets = configuredAssetIdSet.size
    ? assets.filter((a) => configuredAssetIdSet.has(String(a?._id || a?.id || "").trim()))
    : assets.filter((a) => a?.role === "try_on");

  const sourceAssets = configuredAssets.length ? configuredAssets : assets;

  let glbUrl = "";
  let usdzUrl = "";
  sourceAssets.forEach((asset) => {
    if (!asset || asset.assetType !== "3d") return;
    const format = String(asset.format || "").trim().toLowerCase();
    const url = asset?.url || "";
    const ar = asset?.ar || {};
    if (!glbUrl && (format === "glb" || format === "gltf")) {
      glbUrl = ar.glbUrl || url || "";
    }
    if (!usdzUrl && format === "usdz") {
      usdzUrl = ar.usdzUrl || url || "";
    }
  });

  const resourcePaths = Array.isArray(tryOn?.resourcePaths)
    ? tryOn.resourcePaths.map((p) => String(p || "").trim()).filter(Boolean)
    : [];
  if (!glbUrl) glbUrl = directGlbUrl;
  if (!usdzUrl) usdzUrl = directUsdzUrl;
  const prefab = {
    rotation,
    scale,
    translation,
    gravity,
    cut,
    ...(typeof usePhysics === "boolean" ? { usePhysics } : {}),
    ...(Array.isArray(colliders) ? { colliders } : {}),
  };

  const launchUrl =
    (isWebTryOnUrl(directLaunchUrl) ? directLaunchUrl : "") ||
    (isWebTryOnUrl(arUrl) ? arUrl : "");
  const ready = published && Boolean(effectPath || glbUrl || usdzUrl || launchUrl);

  return {
    enabled,
    status,
    published,
    ready,
    arUrl,
    scene,
    effectPath,
    prefab,
    resourcePaths,
    glbUrl,
    usdzUrl,
    launchUrl,
    assetIds: configuredAssetIds.map((id) => String(id || "")).filter(Boolean),
  };
}

function withDemoTryOn(tryOn, productType) {
  if (!TRYON_FORCE_DEMO || productType !== "FRAME") return tryOn;
  if (tryOn?.ready) return tryOn;

  const effectPath = TRYON_DEMO_EFFECT_PATH || tryOn?.effectPath || "";
  const resourcePaths = TRYON_DEMO_RESOURCE_PATHS.length
    ? TRYON_DEMO_RESOURCE_PATHS
    : Array.isArray(tryOn?.resourcePaths)
      ? tryOn.resourcePaths
      : [];

  return {
    ...tryOn,
    enabled: true,
    status: "published",
    published: true,
    ready: Boolean(effectPath || tryOn?.launchUrl),
    effectPath,
    resourcePaths,
  };
}

export function mapApiProductToUi(product) {
  if (!product) return null;

  const assets = normalizeAssets(product?.media?.assets || []);
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const variantAssetsById = buildVariantAssetMap(variants, assets);
  const mediaTryOn = product?.media?.tryOn || {};
  const tryOnAssetIds = Array.isArray(mediaTryOn?.assetIds) ? mediaTryOn.assetIds : [];
  const tryOnAssetIdSet = new Set(tryOnAssetIds.map((id) => toIdString(id)).filter(Boolean));
  const tryOnAssets = assets.filter((asset) => tryOnAssetIdSet.has(toIdString(asset.id)));

  const { price, originalPrice, discountPct } = computePricing(product?.pricing || {});

  const totalStock = variants
    .map((v) => safeNumber(v?.stock))
    .filter((v) => v != null)
    .reduce((sum, v) => sum + v, 0);

  const stockStatus = computeStockStatus(product, variants.length ? totalStock : null);

  const uiType = normalizeType(product?.type);

  const preorderEnabled = product?.preOrder?.enabled === true;

  const orderTypes =
    uiType === "LENS"
      ? ["READY", "CUSTOM"]
      : preorderEnabled
        ? ["READY", "PREORDER", "CUSTOM"]
        : ["READY", "CUSTOM"];

  const defaultOrderType = stockStatus === "PREORDER" ? "PREORDER" : "READY";

  const { colors, sizes, colorDots } = buildVariantsMeta(variants, assets, variantAssetsById);

  // const has3D = assets.some((a) => a?.assetType === "3d" || a?.role === "viewer" || a?.role === "try_on");
  // const tryOn = withDemoTryOn(buildTryOnMeta(product?.media || {}), uiType);
  const has3D = assets.some((a) => a?.assetType === "3d" || a?.role === "viewer" || a?.role === "try_on");
  const tryOn = withDemoTryOn(buildTryOnMeta(product?.media || {}), uiType);
  const default3DAsset = pick3DAsset(assets);

  const apiId = product?._id || product?.id || null;

  return {
    id: String(apiId || product?.slug || ""),
    apiId: apiId ? String(apiId) : null,
    type: uiType,
    apiType: product?.type || null,
    name: product?.name || "",
    slug: product?.slug || "",
    brand: product?.brand || "",
    price,
    originalPrice,
    discountPct,
    status: STATUS_LABEL[stockStatus] || STATUS_LABEL.IN_STOCK,
    stockStatus,
    stockLabel: STOCK_LABEL[stockStatus] || STOCK_LABEL.IN_STOCK,
    totalStock: totalStock,
    variants: variants,
    image: pickHeroImage(assets),
    color: colorDots,

    ratingAvg: safeNumber(product?.ratingsAverage) ?? 0,
    ratingCount: safeNumber(product?.ratingsQuantity) ?? 0,
    soldCount: safeNumber(product?.ratingsQuantity) ?? 0,

    shipping: buildShipping(product?.fulfillment),

    orderTypes,
    defaultOrderType,

    colors,
    sizes,
    qtyLimits: { min: 1, max: 99 },
    // model3D: {
    //   enabled: has3D,
    //   defaultAsset: pick3DAsset(assets),
    //   glbUrl:
    //     tryOn?.glbUrl ||
    //     pick3DAsset(assets)?.ar?.glbUrl ||
    //     pick3DAsset(assets)?.url ||
    //     "",
    // },
    model3D: {
      enabled: has3D,
      defaultAsset: default3DAsset,
      glbUrl: tryOn?.glbUrl || default3DAsset?.ar?.glbUrl || default3DAsset?.url || "",
    },
    media: {
      assets,
      byVariant: variantAssetsById,
      tryOn: {
        enabled: Boolean(mediaTryOn?.enabled),
        status: mediaTryOn?.status || null,
        assets: tryOnAssets,
      },
    },
    tryOn,

    specs: buildSpecsList(product),
    sections: {
      description: product?.description || "",
      sizeGuide: "",
    },

    qaCount: 0,
    relatedIds: [],
    preOrder: product?.preOrder ?? { enabled: false, allowCod: true },
  };
}

export function mapApiProductsToUi(list = []) {
  return list.map(mapApiProductToUi).filter(Boolean);
}

export async function fetchProducts(params = {}) {
  const limit = params.limit || 100;
  let page = params.page || 1;
  let totalPages = 1;
  const all = [];

  do {
    const res = await api.get("/api/products", {
      params: { ...params, page, limit },
    });
    const data = res?.data?.data || [];
    all.push(...data);
    totalPages = res?.data?.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  const merged = await attachSupabaseTryOnToProducts(all);
  return mapApiProductsToUi(merged);
}

export function getRelatedProducts(products, product, limit = 8) {
  if (!product) return [];
  const related = products.filter((p) => {
    if (!p || p.id === product.id) return false;
    if (product.brand && p.brand === product.brand) return true;
    return p.type === product.type;
  });
  return related.slice(0, limit);
}

export async function fetchProductById(id) {
  const res = await api.get(`/api/products/${id}`);
  const raw = res?.data?.data;
  const [merged] = await attachSupabaseTryOnToProducts(raw ? [raw] : []);
  return mapApiProductToUi(merged || raw);
}
