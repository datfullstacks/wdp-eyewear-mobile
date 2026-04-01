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

const orderProductCache = new Map();
const orderProductInFlight = new Map();

function toEntityId(value) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || null;
  }
  if (typeof value === "object") {
    if (value._id != null) return toEntityId(value._id);
    if (value.id != null) return toEntityId(value.id);
  }
  return null;
}

function pickOrderItemImage(raw) {
  return (
    raw?.image ||
    raw?.thumbnail ||
    raw?.thumb ||
    raw?.product?.image ||
    raw?.productId?.image ||
    null
  );
}

function localizeOrderActionMessage(message, fallback = "Không thể thực hiện thao tác.") {
  const normalized = String(message || "").trim();
  if (!normalized) return fallback;

  const knownMessages = {
    "shipping fee refund is only allowed when responsibility is system, carrier, or mixed":
      "Chỉ được hoàn phí vận chuyển khi trách nhiệm thuộc hệ thống, đơn vị vận chuyển hoặc hỗn hợp.",
    "Order cannot be cancelled at this stage":
      "Đơn hàng không thể hủy ở giai đoạn hiện tại.",
    "Order already cancelled": "Đơn hàng này đã được hủy trước đó.",
    "This order already has an active refund request":
      "Đơn hàng này đã có yêu cầu hoàn tiền đang được xử lý.",
    "This order has no refundable paid amount":
      "Đơn hàng này chưa có khoản thanh toán có thể hoàn.",
    "Refund request is only available for paid pending-confirmation, cancelled, delivered, or returned orders":
      "Yêu cầu hoàn tiền chỉ áp dụng cho đơn đã thanh toán đang chờ xác nhận, đã hủy, đã giao hoặc đã trả.",
    "This order has no active refund request":
      "Đơn hàng này hiện không có yêu cầu hoàn tiền đang xử lý.",
    "Invalid refund action":
      "Thao tác hoàn tiền không hợp lệ.",
    "bankCode is required":
      "Vui lòng chọn ngân hàng nhận tiền.",
    "bankName is required":
      "Tên ngân hàng không hợp lệ.",
    "accountNumber is required":
      "Vui lòng nhập số tài khoản nhận tiền.",
    "accountHolder is required":
      "Vui lòng nhập tên chủ tài khoản nhận tiền.",
    "accountNumber must contain 8 to 19 digits":
      "Số tài khoản phải gồm từ 8 đến 19 chữ số.",
    "Refund workflow is currently disabled.":
      "Tính năng hoàn tiền hiện đang tạm khóa.",
    Forbidden: "Bạn không có quyền thực hiện thao tác này.",
  };

  return knownMessages[normalized] || normalized;
}

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

function resolveOrderType(raw) {
  const explicitOrderType = String(raw?.orderType || "").trim();
  if (explicitOrderType) return explicitOrderType;

  if (Array.isArray(raw?.items) && raw.items.length > 0) {
    const inferred = buildOrderType(raw.items[0]);
    if (inferred) return inferred;
  }

  return "";
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
    productId: toEntityId(raw?.productId),
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

    image: pickOrderItemImage(raw),
    productColors: [],
    productSizes: [],
  };
}

function normalizeOrderItemSummary(raw) {
  const catalogType = normalizeProductType(raw?.type);
  return {
    itemId: raw?._id ?? null,
    productId: toEntityId(raw?.productId),
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
    image: pickOrderItemImage(raw),
  };
}

function normalizeStr(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeOrderDisplayStatus(raw) {
  const baseStatus = normalizeStr(raw?.rawStatus || raw?.status);
  const opsStage = normalizeStr(raw?.opsStage);
  const shipmentStatus = normalizeStr(raw?.shipment?.latestStatus);

  if (
    ["cancelled", "canceled"].includes(baseStatus) ||
    ["cancelled", "canceled"].includes(opsStage) ||
    ["cancel", "cancelled"].includes(shipmentStatus)
  ) {
    return "cancelled";
  }

  if (
    baseStatus === "returned" ||
    opsStage === "returned" ||
    shipmentStatus === "returned"
  ) {
    return "returned";
  }

  if (
    ["delivered", "completed"].includes(baseStatus) ||
    ["delivered", "closed"].includes(opsStage) ||
    shipmentStatus === "delivered"
  ) {
    return "delivered";
  }

  if (
    [
      "shipment_created",
      "handover_to_carrier",
      "in_transit",
      "delivery_failed",
      "waiting_redelivery",
      "return_pending",
      "return_in_transit",
      "exception_hold",
    ].includes(opsStage) ||
    [
      "ready_to_pick",
      "picking",
      "money_collect_picking",
      "picked",
      "storing",
      "sorting",
      "transporting",
      "delivering",
      "money_collect_delivering",
      "delivery_fail",
      "waiting_to_return",
      "return",
      "return_transporting",
      "return_sorting",
      "returning",
      "damage",
      "lost",
      "exception",
      "return_fail",
    ].includes(shipmentStatus)
  ) {
    return "shipped";
  }

  return raw?.status ?? "pending";
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
    const cacheKey = String(item.productId);

    if (orderProductCache.has(cacheKey)) {
      return enrichVariantWithProduct(item, orderProductCache.get(cacheKey));
    }

    if (orderProductInFlight.has(cacheKey)) {
      const product = await orderProductInFlight.get(cacheKey);
      return product ? enrichVariantWithProduct(item, product) : item;
    }

    const request = fetchProductById(item.productId);
    orderProductInFlight.set(cacheKey, request);

    const product = await request;
    orderProductInFlight.delete(cacheKey);
    if (!product) return item;
    orderProductCache.set(cacheKey, product);
    return enrichVariantWithProduct(item, product);
  } catch {
    orderProductInFlight.delete(String(item.productId));
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
  const orderType = resolveOrderType(raw);

  return {
    _id: raw?._id ?? raw?.id ?? null,
    id: raw?._id ?? raw?.id ?? null,
    paymentCode: raw?.paymentCode ?? raw?.payment?.code ?? "",
    status: normalizeOrderDisplayStatus(raw),
    rawStatus: raw?.rawStatus ?? raw?.status ?? "",
    paymentStatus: raw?.paymentStatus ?? raw?.payment?.status ?? "",
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    total: raw?.total ?? 0,
    subTotal: raw?.subTotal ?? raw?.subtotal ?? 0,
    shippingFee: raw?.shippingFee ?? 0,
    discountAmount: raw?.discountAmount ?? 0,
    orderType,
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
    status: normalizeOrderDisplayStatus(raw),
    rawStatus: raw?.rawStatus ?? raw?.status ?? "",
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

export async function cancelOrderApi(orderId, payload = {}) {
  if (!orderId) throw new Error("Missing orderId");

  try {
    const res = await api.put(`/api/orders/${orderId}/cancel`, payload);
    return res?.data?.data ?? res?.data ?? null;
  } catch (error) {
    const localizedMessage = localizeOrderActionMessage(
      error?.response?.data?.message || error?.response?.data?.error || error?.message,
      "Không thể hủy đơn.",
    );

    if (error?.response?.data) {
      error.response.data.message = localizedMessage;
      error.response.data.error = localizedMessage;
    }
    error.message = localizedMessage;
    throw error;
  }
}

export async function requestRefundApi(orderId, payload = {}) {
  if (!orderId) throw new Error("Missing orderId");

  try {
    const res = await api.post(`/api/orders/${orderId}/refund-request`, payload);
    return res?.data?.data ?? res?.data ?? null;
  } catch (error) {
    const localizedMessage = localizeOrderActionMessage(
      error?.response?.data?.message || error?.response?.data?.error || error?.message,
      "Không thể tạo yêu cầu hoàn tiền.",
    );

    if (error?.response?.data) {
      error.response.data.message = localizedMessage;
      error.response.data.error = localizedMessage;
    }
    error.message = localizedMessage;
    throw error;
  }
}

export async function updateRefundApi(orderId, payload = {}) {
  if (!orderId) throw new Error("Missing orderId");

  try {
    const res = await api.put(`/api/orders/${orderId}/refund`, payload);
    return res?.data?.data ?? res?.data ?? null;
  } catch (error) {
    const localizedMessage = localizeOrderActionMessage(
      error?.response?.data?.message || error?.response?.data?.error || error?.message,
      "Không thể cập nhật yêu cầu hoàn tiền.",
    );

    if (error?.response?.data) {
      error.response.data.message = localizedMessage;
      error.response.data.error = localizedMessage;
    }
    error.message = localizedMessage;
    throw error;
  }
}
