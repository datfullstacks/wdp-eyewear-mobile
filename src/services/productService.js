import { api } from "./apiClient";

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

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function pickHeroImage(assets = []) {
  const hero2d =
    assets.find((a) => a?.role === "hero" && a?.assetType === "2d") ||
    assets.find((a) => a?.assetType === "2d") ||
    assets.find((a) => a?.role === "hero") ||
    assets[0];

  return hero2d?.url || DEFAULT_IMAGE;
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

function computeStockStatus(product, totalStock) {
  const statusRaw = String(product?.status || "").toLowerCase();
  if (statusRaw === "out_of_stock") return "OUT_OF_STOCK";
  if (statusRaw === "inactive") return "OUT_OF_STOCK";
  if (statusRaw === "draft") return "PREORDER";

  if (product?.inventory?.track && typeof totalStock === "number") {
    if (totalStock <= 0) return "OUT_OF_STOCK";
    return "IN_STOCK";
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

function buildVariantsMeta(variants = [], assets = []) {
  const colors = uniq(variants.map((v) => v?.options?.color));
  const sizes = uniq(variants.map((v) => v?.options?.size).map((s) => (s != null ? String(s) : null)));

  const assetUrlById = new Map(
    assets.map((a) => [String(a?._id || a?.id || ""), a?.url]).filter((x) => x[0] && x[1])
  );

  const colorToImage = new Map();
  variants.forEach((v) => {
    const color = v?.options?.color;
    const assetId = Array.isArray(v?.assetIds) ? v.assetIds[0] : null;
    if (!color || !assetId) return;
    const url = assetUrlById.get(String(assetId));
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

export function mapApiProductToUi(product) {
  if (!product) return null;

  const assets = product?.media?.assets || [];
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  const { price, originalPrice, discountPct } = computePricing(product?.pricing || {});

  const totalStock = variants
    .map((v) => safeNumber(v?.stock))
    .filter((v) => v != null)
    .reduce((sum, v) => sum + v, 0);

  const stockStatus = computeStockStatus(product, variants.length ? totalStock : null);

  const uiType = normalizeType(product?.type);

  const orderTypes = uiType === "LENS" ? ["READY", "CUSTOM"] : ["READY", "PREORDER", "CUSTOM"];
  const defaultOrderType = stockStatus === "PREORDER" ? "PREORDER" : "READY";

  const { colors, sizes, colorDots } = buildVariantsMeta(variants, assets);

  const has3D = assets.some((a) => a?.assetType === "3d" || a?.role === "viewer");

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
    model3D: { enabled: has3D },

    specs: buildSpecsList(product),
    sections: {
      description: product?.description || "",
      sizeGuide: "",
    },

    qaCount: 0,
    relatedIds: [],
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

  return mapApiProductsToUi(all);
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
  return mapApiProductToUi(res?.data?.data);
}