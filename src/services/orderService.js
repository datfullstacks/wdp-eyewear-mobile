import { api } from "./apiClient";
import {
  fetchProductById,
  getCatalogDisplayLabel,
  normalizeCatalogType,
} from "./productService";
import {
  buildLensPrescriptionPayload,
  inferLensPrescriptionMethod,
  normalizeLensPrescriptionDraft,
  summarizeLensPrescription,
} from "./lensPrescriptionService";

function pickData(res) {
  const raw = res?.data;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function pickPagination(res) {
  return (
    res?.data?.pagination || {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    }
  );
}

function normalizeProductType(apiType) {
  return normalizeCatalogType(apiType);
}

function isFrameLikeProductType(productType) {
  return productType === "FRAME" || productType === "SUNGLASSES";
}

function requiresLensRxFlowType(productType) {
  return productType === "LENS";
}

function toRxEye(eye) {
  if (!eye) return { SPH: "", CYL: "", AXIS: "", ADD: "" };
  return {
    SPH: String(eye?.sphere ?? eye?.SPH ?? ""),
    CYL: String(eye?.cyl ?? eye?.CYL ?? ""),
    AXIS: String(eye?.axis ?? eye?.AXIS ?? ""),
    ADD: String(eye?.add ?? eye?.ADD ?? ""),
  };
}

function buildOrderType(raw) {
  const isPreOrder = Boolean(raw?.preOrder);
  if (isPreOrder) return "PREORDER";

  const mode = String(raw?.customization?.prescription?.mode || "none").toLowerCase();
  if (mode === "upload" || mode === "attachment") return "CUSTOM";
  return "READY";
}

function buildVariantText(productType, variant) {
  const colorName = variant?.colorName || null;
  const size = variant?.size || null;

  if (isFrameLikeProductType(productType)) {
    if (colorName && size) return `Màu: ${colorName}, Size: ${size}`;
    if (colorName) return `Màu: ${colorName}`;
    if (size) return `Size: ${size}`;
    return null;
  }

  if (colorName) return `Màu: ${colorName}`;
  if (size) return `Size: ${size}`;

  return null;
}

function normalizeOrderItemDetail(raw) {
  const orderType = buildOrderType(raw);
  const productType = normalizeProductType(raw?.type);

  const colorName =
    raw?.customization?.selectedColor ||
    raw?.variantOptions?.color ||
    raw?.variantOptions?.colorName ||
    null;
  const size =
    raw?.customization?.selectedSize ||
    raw?.variantOptions?.size ||
    raw?.variantOptions?.sizeName ||
    null;

  const variant = {
    variantId: raw?.variantId ?? null,
    colorId: null,
    colorName,
    size,
  };

  const prescription = raw?.customization?.prescription || {};
  const prescriptionMethod = inferLensPrescriptionMethod(prescription);
  const prescriptionDraft = normalizeLensPrescriptionDraft(prescription);
  const prescriptionSummary = summarizeLensPrescription(prescription);

  const rxOD = prescriptionMethod !== "upload" ? toRxEye(prescription?.rightEye) : null;
  const rxOS = prescriptionMethod !== "upload" ? toRxEye(prescription?.leftEye) : null;

  const attachmentUrls = Array.isArray(prescription?.attachmentUrls)
    ? prescription.attachmentUrls
    : [];
  const firstRxUrl = attachmentUrls.find(Boolean) || null;

  const rxPhoto = firstRxUrl
    ? { uri: firstRxUrl, name: "rx-upload", type: "image/jpeg" }
    : null;

  return {
    itemId: raw?._id ?? null,
    productId: raw?.productId ?? null,
    variantId: raw?.variantId ?? null,

    name: raw?.name ?? "Sản phẩm",
    type: raw?.type ?? "other",
    productType,
    catalogType: productType,
    displayLabel: getCatalogDisplayLabel(productType),
    requiresLensRxFlow: requiresLensRxFlowType(productType),
    customization: raw?.customization || {},

    qty: raw?.quantity ?? 1,
    quantity: raw?.quantity ?? 1,
    price: raw?.unitPrice ?? 0,
    unitPrice: raw?.unitPrice ?? 0,
    lineTotal: raw?.lineTotal ?? 0,

    preOrder: Boolean(raw?.preOrder),
    preorder: Boolean(raw?.preOrder),

    depositPercent: raw?.depositPercent ?? 100,
    payNow: raw?.payNow ?? 0,
    payLater: raw?.payLater ?? 0,

    orderType,
    prescriptionMethod,
    prescriptionDraft,
    prescriptionSummary,
    rxOD,
    rxOS,
    rxPhoto,
    readyNote: raw?.customization?.note || null,

    variant,
    variantText: buildVariantText(productType, variant),

    image: null,
    productColors: [],
    productSizes: [],
  };
}

function normalizeOrderItemSummary(raw) {
  const catalogType = normalizeProductType(raw?.type);
  return {
    itemId: raw?._id ?? null,
    productId: raw?.productId ?? null,
    variantId: raw?.variantId ?? null,
    name: raw?.name ?? "Sản phẩm",
    type: raw?.type ?? "other",
    catalogType,
    displayLabel: getCatalogDisplayLabel(catalogType),
    qty: raw?.quantity ?? 1,
    quantity: raw?.quantity ?? 1,
    price: raw?.unitPrice ?? 0,
    unitPrice: raw?.unitPrice ?? 0,
    lineTotal: raw?.lineTotal ?? 0,
    preOrder: Boolean(raw?.preOrder),
    preorder: Boolean(raw?.preOrder),
    depositPercent: raw?.depositPercent ?? 100,
    payNow: raw?.payNow ?? 0,
    payLater: raw?.payLater ?? 0,
    image: null,
  };
}

function normalizeStr(value) {
  return String(value ?? "").trim().toLowerCase();
}

function enrichVariantWithProduct(item, product) {
  const colors = Array.isArray(product?.colors) ? product.colors : [];
  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];

  let nextVariant = item?.variant || null;

  if (nextVariant?.colorName && !nextVariant?.colorId && colors.length > 0) {
    const match = colors.find((c) => {
      const cName = c?.name || c?.label || "";
      return normalizeStr(cName) === normalizeStr(nextVariant.colorName);
    });

    if (match?.id) {
      nextVariant = {
        ...nextVariant,
        colorId: match.id,
        colorName: nextVariant.colorName || match?.name || match?.label || null,
      };
    }
  }

  if (nextVariant?.size && sizes.length > 0) {
    const matchSize = sizes.find((s) => normalizeStr(s) === normalizeStr(nextVariant.size));
    if (matchSize) {
      nextVariant = {
        ...nextVariant,
        size: matchSize,
      };
    }
  }

  return {
    ...item,
    product,
    variant: nextVariant,
    variantText: buildVariantText(item?.productType, nextVariant),
    image: product?.image ?? item?.image ?? null,
    productColors: colors,
    productSizes: sizes,
  };
}

async function enrichItemWithProduct(item) {
  if (!item?.productId) return item;

  try {
    const product = await fetchProductById(item.productId);
    if (!product) return item;
    return enrichVariantWithProduct(item, product);
  } catch {
    return item;
  }
}

function buildPatchPayload(orderItem, patch = {}) {
  const nextVariant = {
    ...(orderItem?.variant || {}),
    ...(patch?.variant || {}),
  };

  const existingCustomization = orderItem?.customization || {};
  const nextPrescriptionDraft =
    patch?.prescriptionDraft ??
    normalizeLensPrescriptionDraft(
      patch?.customization?.prescription || existingCustomization?.prescription || {}
    );
  const nextPrescriptionMethod =
    patch?.prescriptionMethod ||
    inferLensPrescriptionMethod(
      patch?.customization?.prescription || existingCustomization?.prescription || {}
    );

  const payload = {};

  const stableVariantId =
    patch?.variantId ||
    patch?.variant?.variantId ||
    orderItem?.variantId ||
    orderItem?.variant?.variantId ||
    null;

  if (stableVariantId) {
    payload.variantId = stableVariantId;
  }

  if (patch?.quantity != null) {
    payload.quantity = patch.quantity;
  }

  const customization = {
    ...(existingCustomization || {}),
    ...(patch?.customization || {}),
    selectedColor:
      nextVariant?.colorName ||
      nextVariant?.colorId ||
      patch?.customization?.selectedColor ||
      existingCustomization?.selectedColor ||
      undefined,
    selectedSize:
      isFrameLikeProductType(orderItem?.productType)
        ? nextVariant?.size || patch?.customization?.selectedSize || existingCustomization?.selectedSize || undefined
        : undefined,
    note:
      patch?.readyNote != null
        ? String(patch.readyNote).trim()
        : patch?.customization?.note ?? orderItem?.readyNote ?? existingCustomization?.note ?? undefined,
  };

  if (requiresLensRxFlowType(orderItem?.productType)) {
    customization.prescription =
      patch?.customization?.prescription ||
      buildLensPrescriptionPayload({
        method: nextPrescriptionMethod,
        draft: nextPrescriptionDraft,
      });
  }

  const hasCustomization = Object.values(customization).some(
    (v) => v !== undefined && v !== null
  );

  if (hasCustomization) {
    payload.customization = customization;
  }

  if (patch?.note != null) {
    payload.note = String(patch.note).trim();
  }

  return payload;
}

function resolveOrderFetchOptions(options) {
  if (typeof options === "boolean") {
    return {
      enrichProducts: options,
      includeItems: true,
      detailLevel: "summary",
    };
  }

  return {
    enrichProducts: Boolean(options?.enrichProducts),
    includeItems: options?.includeItems !== false,
    detailLevel: options?.detailLevel === "detail" ? "detail" : "summary",
  };
}

function normalizeOrderForList(raw, options = {}) {
  const includeItems = options?.includeItems !== false;
  const detailLevel = options?.detailLevel === "detail" ? "detail" : "summary";
  const itemMapper =
    detailLevel === "detail" ? normalizeOrderItemDetail : normalizeOrderItemSummary;

  return {
    _id: raw?._id ?? raw?.id ?? null,
    id: raw?._id ?? raw?.id ?? null,
    paymentCode: raw?.paymentCode ?? raw?.payment?.code ?? "",
    status: raw?.status ?? "pending",
    paymentStatus: raw?.paymentStatus ?? raw?.payment?.status ?? "",
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    total: raw?.total ?? 0,
    subTotal: raw?.subTotal ?? raw?.subtotal ?? 0,
    shippingFee: raw?.shippingFee ?? 0,
    discountAmount: raw?.discountAmount ?? 0,
    promotionApplied: raw?.promotionApplied ?? null,
    payNowTotal: raw?.payNowTotal ?? 0,
    payLaterTotal: raw?.payLaterTotal ?? 0,
    paidAmount: raw?.paidAmount ?? 0,
    refund: raw?.refund ?? null,
    items:
      includeItems && Array.isArray(raw?.items)
        ? raw.items.map(itemMapper)
        : [],
  };
}

export async function getMyOrdersApi(params = {}, options = {}) {
  const resolvedOptions = resolveOrderFetchOptions(options);
  const res = await api.get("/api/orders/me", { params });
  const rawOrders = pickData(res);
  const pagination = pickPagination(res);

  let orders = rawOrders.map((order) => normalizeOrderForList(order, resolvedOptions));

  if (resolvedOptions.enrichProducts && resolvedOptions.includeItems) {
    orders = await Promise.all(
      orders.map(async (order) => ({
        ...order,
        items: await Promise.all(order.items.map(enrichItemWithProduct)),
      }))
    );
  }

  return { items: orders, pagination };
}

export async function getOrderByIdApi(orderId, enrichProducts = true) {
  const res = await api.get(`/api/orders/${orderId}`);
  const raw = res?.data?.data ?? null;
  if (!raw) return null;

  const order = {
    ...raw,
    promotionApplied: raw?.promotionApplied ?? null,
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeOrderItemDetail) : [],
  };

  if (!enrichProducts) return order;

  return {
    ...order,
    items: await Promise.all(order.items.map(enrichItemWithProduct)),
  };
}

export async function patchOrderItemApi(orderId, itemId, orderItem, patch = {}) {
  if (!orderId || !itemId) {
    throw new Error("Missing orderId or itemId");
  }

  const payload = buildPatchPayload(orderItem, patch);
  const res = await api.patch(`/api/orders/${orderId}/items/${itemId}`, payload);
  return res?.data?.data ?? res?.data ?? null;
}

export async function cancelOrderApi(orderId) {
  if (!orderId) throw new Error("Missing orderId");

  // API doc: PUT /api/orders/{id}/cancel
  const res = await api.put(`/api/orders/${orderId}/cancel`);
  return res?.data?.data ?? res?.data ?? null;
}

export async function requestRefundApi(orderId, payload = {}) {
  if (!orderId) throw new Error("Missing orderId");

  const res = await api.post(`/api/orders/${orderId}/refund-request`, payload);
  return res?.data?.data ?? res?.data ?? null;
}

export async function updateRefundApi(orderId, payload = {}) {
  if (!orderId) throw new Error("Missing orderId");

  const res = await api.put(`/api/orders/${orderId}/refund`, payload);
  return res?.data?.data ?? res?.data ?? null;
}
