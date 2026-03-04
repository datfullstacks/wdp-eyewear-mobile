import { api } from "./apiClient";
import { fetchProductById } from "./productService";

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
  const t = String(apiType || "").toLowerCase();
  if (t === "lens" || t === "contact_lens") return "LENS";
  if (t === "frame" || t === "sunglasses") return "FRAME";
  return "OTHER";
}

function isRxFilled(rxOD, rxOS) {
  const okOD = Boolean(rxOD?.CYL) && Boolean(rxOD?.AXIS);
  const okOS = Boolean(rxOS?.CYL) && Boolean(rxOS?.AXIS);
  return okOD && okOS;
}

function toRxEye(eye) {
  if (!eye) return { CYL: "", AXIS: "" };
  return {
    CYL: String(eye?.cyl ?? eye?.CYL ?? ""),
    AXIS: String(eye?.axis ?? eye?.AXIS ?? ""),
  };
}

function buildOrderType(raw) {
  const isPreOrder = Boolean(raw?.preOrder);
  if (isPreOrder) return "PREORDER";

  const mode = String(raw?.customization?.prescription?.mode || "none").toLowerCase();
  if (mode === "upload") return "CUSTOM";
  return "READY";
}

function buildVariantText(productType, variant) {
  const colorName = variant?.colorName || null;
  const size = variant?.size || null;

  if (productType === "FRAME") {
    if (colorName && size) return `Màu: ${colorName}, Size: ${size}`;
    if (colorName) return `Màu: ${colorName}`;
    if (size) return `Size: ${size}`;
    return null;
  }

  if (productType === "LENS") {
    if (colorName) return `Màu: ${colorName}`;
    if (size) return `Size: ${size}`;
  }

  return null;
}

function normalizeOrderItem(raw) {
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
  const mode = String(prescription?.mode || "none").toLowerCase();

  const rxOD = mode === "manual" ? toRxEye(prescription?.rightEye) : null;
  const rxOS = mode === "manual" ? toRxEye(prescription?.leftEye) : null;

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

function buildPrescriptionPayload(orderType, rxOD, rxOS, rxPhoto) {
  if (orderType === "READY") {
    if (!isRxFilled(rxOD, rxOS)) return { mode: "none", isMyopic: false };
    return {
      mode: "manual",
      isMyopic: true,
      rightEye: {
        cyl: String(rxOD?.CYL ?? ""),
        axis: String(rxOD?.AXIS ?? ""),
      },
      leftEye: {
        cyl: String(rxOS?.CYL ?? ""),
        axis: String(rxOS?.AXIS ?? ""),
      },
    };
  }

  if (orderType === "CUSTOM") {
    const photoUrl = rxPhoto?.uri || null;
    if (!photoUrl) return { mode: "none", isMyopic: false };
    return {
      mode: "upload",
      isMyopic: true,
      attachmentUrls: [photoUrl],
    };
  }

  if (orderType === "PREORDER") {
    if (isRxFilled(rxOD, rxOS)) {
      return {
        mode: "manual",
        isMyopic: true,
        rightEye: {
          cyl: String(rxOD?.CYL ?? ""),
          axis: String(rxOD?.AXIS ?? ""),
        },
        leftEye: {
          cyl: String(rxOS?.CYL ?? ""),
          axis: String(rxOS?.AXIS ?? ""),
        },
      };
    }

    const photoUrl = rxPhoto?.uri || null;
    if (photoUrl) {
      return {
        mode: "upload",
        isMyopic: true,
        attachmentUrls: [photoUrl],
      };
    }
  }

  return { mode: "none", isMyopic: false };
}

function buildPatchPayload(orderItem, patch = {}) {
  const nextVariant = {
    ...(orderItem?.variant || {}),
    ...(patch?.variant || {}),
  };

  const nextRxOD = patch?.rxOD ?? orderItem?.rxOD ?? null;
  const nextRxOS = patch?.rxOS ?? orderItem?.rxOS ?? null;
  const nextRxPhoto = patch?.rxPhoto ?? orderItem?.rxPhoto ?? null;

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
    selectedColor: nextVariant?.colorName || nextVariant?.colorId || undefined,
    selectedSize:
      orderItem?.productType === "FRAME" ? nextVariant?.size || undefined : undefined,
    note:
      patch?.readyNote != null
        ? String(patch.readyNote).trim()
        : orderItem?.readyNote || undefined,
  };

  if (orderItem?.productType === "LENS") {
    customization.prescription = buildPrescriptionPayload(
      orderItem?.orderType || "READY",
      nextRxOD,
      nextRxOS,
      nextRxPhoto
    );
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

export async function getMyOrdersApi(params = {}, enrichProducts = false) {
  const res = await api.get("/api/orders/me", { params });
  const rawOrders = pickData(res);
  const pagination = pickPagination(res);

  let orders = rawOrders.map((order) => ({
    ...order,
    items: Array.isArray(order?.items) ? order.items.map(normalizeOrderItem) : [],
  }));

  if (enrichProducts) {
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
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeOrderItem) : [],
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
