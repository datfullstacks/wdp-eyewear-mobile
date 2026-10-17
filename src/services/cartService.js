import { api } from "./apiClient";

function pickData(res) {
  return res?.data?.data ?? res?.data ?? null;
}

// Cart types của backend:
// - "ready_stock"
// - "pre_order"
export const API_CART_TYPES = {
  READY_STOCK: "ready_stock",
  PRE_ORDER: "pre_order",
};

let cartBadgeQty = 0;
const cartBadgeListeners = new Set();

function emitCartBadgeQty(nextQty) {
  cartBadgeQty = Math.max(0, Math.floor(Number(nextQty) || 0));
  for (const listener of cartBadgeListeners) {
    listener(cartBadgeQty);
  }
}

function calcCartBadgeQty(readyItems = [], preorderItems = []) {
  return [...readyItems, ...preorderItems].reduce(
    (sum, item) => sum + Number(item?.quantity ?? item?.qty ?? 0),
    0,
  );
}

export function getCartBadgeQty() {
  return cartBadgeQty;
}

export function subscribeCartBadgeQty(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  cartBadgeListeners.add(listener);
  listener(cartBadgeQty);

  return () => {
    cartBadgeListeners.delete(listener);
  };
}

export function setCartBadgeQty(nextQty) {
  emitCartBadgeQty(nextQty);
}

export function changeCartBadgeQty(delta) {
  emitCartBadgeQty(cartBadgeQty + Number(delta || 0));
}

export function syncCartBadgeQty({ readyItems = [], preorderItems = [] } = {}) {
  emitCartBadgeQty(calcCartBadgeQty(readyItems, preorderItems));
}

export async function refreshCartBadgeQty() {
  try {
    const [readyCart, preorderCart] = await Promise.all([
      getMyCartApi(API_CART_TYPES.READY_STOCK),
      getMyCartApi(API_CART_TYPES.PRE_ORDER),
    ]);

    syncCartBadgeQty({
      readyItems: Array.isArray(readyCart?.items) ? readyCart.items : [],
      preorderItems: Array.isArray(preorderCart?.items) ? preorderCart.items : [],
    });
  } catch {
    emitCartBadgeQty(0);
  }

  return cartBadgeQty;
}

function toText(value) {
  if (value == null) return "";
  return String(value);
}

function normalizeEyePayload(eye = {}) {
  return {
    sphere: toText(eye?.sphere),
    cyl: toText(eye?.cyl),
    axis: toText(eye?.axis),
    add: toText(eye?.add),
  };
}

function hasManualPrescriptionValues(prescription = {}) {
  const rightEye = prescription?.rightEye || {};
  const leftEye = prescription?.leftEye || {};

  return Boolean(
    toText(rightEye?.sphere) ||
      toText(rightEye?.cyl) ||
      toText(rightEye?.axis) ||
      toText(rightEye?.add) ||
      toText(leftEye?.sphere) ||
      toText(leftEye?.cyl) ||
      toText(leftEye?.axis) ||
      toText(leftEye?.add) ||
      toText(prescription?.pd)
  );
}

function resolveIsMyopicFlag(prescription, hasPayload) {
  if (typeof prescription?.isMyopic === "boolean") {
    return prescription.isMyopic;
  }

  return Boolean(hasPayload);
}

function normalizePrescriptionPayload(prescription = {}) {
  const attachmentUrls = Array.isArray(prescription?.attachmentUrls)
    ? prescription.attachmentUrls.map((item) => toText(item)).filter(Boolean)
    : [];
  const mode = toText(prescription?.mode || "none").toLowerCase() || "none";
  const normalizedMode = mode === "attachment" ? "upload" : mode;
  const rightEye = normalizeEyePayload(prescription?.rightEye);
  const leftEye = normalizeEyePayload(prescription?.leftEye);
  const pd = toText(prescription?.pd);
  const note = toText(prescription?.note);
  const hasManualValues = hasManualPrescriptionValues({
    rightEye,
    leftEye,
    pd,
  });

  if (normalizedMode === "upload") {
    return {
      mode: attachmentUrls.length > 0 ? "upload" : "none",
      isMyopic: attachmentUrls.length > 0
        ? resolveIsMyopicFlag(prescription, attachmentUrls.length > 0)
        : false,
      rightEye: normalizeEyePayload(),
      leftEye: normalizeEyePayload(),
      pd: "",
      note,
      attachmentUrls,
    };
  }

  if (normalizedMode === "manual") {
    return {
      mode: hasManualValues ? "manual" : "none",
      isMyopic: hasManualValues
        ? resolveIsMyopicFlag(prescription, hasManualValues)
        : false,
      rightEye,
      leftEye,
      pd,
      note,
      attachmentUrls: [],
    };
  }

  return {
    mode: "none",
    isMyopic: false,
    rightEye: normalizeEyePayload(),
    leftEye: normalizeEyePayload(),
    pd: "",
    note,
    attachmentUrls: [],
  };
}

function normalizeCombineWithPayload(combineWith = {}) {
  const productId = toText(combineWith?.productId ?? combineWith?.product_id);
  const variantId = toText(combineWith?.variantId ?? combineWith?.variant_id);
  const note = toText(combineWith?.note);

  if (!productId) return undefined;

  return {
    productId,
    product_id: productId,
    variantId,
    variant_id: variantId,
    note,
  };
}

function normalizeCustomizationPayload(customization = {}) {
  return {
    selectedColor: toText(customization?.selectedColor),
    selectedSize: toText(customization?.selectedSize),
    photochromic: Boolean(customization?.photochromic),
    note: toText(customization?.note),
    combineWith: normalizeCombineWithPayload(customization?.combineWith),
    prescription: normalizePrescriptionPayload(customization?.prescription),
  };
}

function normalizeCartItemPayload(payload = {}) {
  const productId = payload.productId ?? payload.product_id ?? "";
  const variantId = payload.variantId ?? payload.variant_id ?? undefined;
  const quantity = Number(payload.quantity ?? 1);
  const itemId = payload.itemId ?? payload.item_id ?? undefined;
  const normalizedProductId = toText(productId);
  const normalizedVariantId = toText(variantId);
  const normalizedItemId = toText(itemId);

  const normalized = {
    productId: normalizedProductId,
    product_id: normalizedProductId,
    quantity: Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1,
    customization: normalizeCustomizationPayload(payload.customization),
  };

  if (normalizedVariantId) {
    normalized.variantId = normalizedVariantId;
    normalized.variant_id = normalizedVariantId;
  }

  if (normalizedItemId) {
    normalized.itemId = normalizedItemId;
    normalized.item_id = normalizedItemId;
  }

  return normalized;
}

/**
 * Lấy giỏ hàng theo loại
 * @param {"ready_stock" | "pre_order"} cartType
 */
export async function getMyCartApi(cartType = "ready_stock") {
  const res = await api.get(`/api/carts/${cartType}`);
  return pickData(res) || null;
}

/**
 * Thêm mới hoặc cập nhật 1 item trong cart
 * Backend sẽ upsert theo itemId/productId tùy rule của server
 *
 * @param {"ready_stock" | "pre_order"} cartType
 * @param {Object} payload
 * {
 *   itemId?: string,
 *   productId: string,
 *   variantId?: string,
 *   quantity: number,
 *   customization?: {
 *     selectedColor?: string,
 *     selectedSize?: string,
 *     photochromic?: boolean,
 *     note?: string,
 *     combineWith?: {
 *       productId?: string,
 *       variantId?: string,
 *       note?: string,
 *     },
 *     prescription?: {
 *       mode?: "none" | string,
 *       isMyopic?: boolean,
 *       rightEye?: { sphere?: string, cyl?: string, axis?: string, add?: string },
 *       leftEye?: { sphere?: string, cyl?: string, axis?: string, add?: string },
 *       pd?: string,
 *       note?: string,
 *       attachmentUrls?: string[],
 *     },
 *   },
 * }
 */
export async function upsertCartItemApi(
  cartType = "ready_stock",
  payload = {},
) {
  const res = await api.put(
    `/api/carts/${cartType}/items`,
    normalizeCartItemPayload(payload),
  );
  return pickData(res) || null;
}

/**
 * Thay toàn bộ danh sách item trong cart
 *
 * @param {"ready_stock" | "pre_order"} cartType
 * @param {Array} items
 */
export async function replaceCartItemsApi(
  cartType = "ready_stock",
  items = [],
) {
  const res = await api.put(`/api/carts/${cartType}/items/bulk`, {
    items: Array.isArray(items) ? items.map(normalizeCartItemPayload) : [],
  });
  return pickData(res) || null;
}

/**
 * Xóa 1 item khỏi cart
 *
 * @param {"ready_stock" | "pre_order"} cartType
 * @param {string} itemId
 */
export async function removeCartItemApi(
  cartType = "ready_stock",
  itemId,
) {
  const res = await api.delete(`/api/carts/${cartType}/items/${itemId}`);
  return pickData(res) || null;
}

/**
 * Xóa toàn bộ cart theo loại
 *
 * @param {"ready_stock" | "pre_order"} cartType
 */
export async function clearCartApi(cartType = "ready_stock") {
  const res = await api.delete(`/api/carts/${cartType}/clear`);
  return pickData(res) || null;
}
