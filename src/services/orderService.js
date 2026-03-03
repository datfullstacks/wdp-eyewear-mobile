// import { api } from "./apiClient";

// function pickData(res) {
//   return res?.data?.data ?? [];
// }

// function pickPagination(res) {
//   return res?.data?.pagination || {
//     page: 1,
//     limit: 10,
//     total: 0,
//     totalPages: 1,
//   };
// }

// export async function getMyOrdersApi(params = {}) {
//   const res = await api.get("/api/orders", { params });
//   return {
//     items: pickData(res),
//     pagination: pickPagination(res),
//   };
// }

// export async function getOrderByIdApi(orderId) {
//   const res = await api.get(`/api/orders/${orderId}`);
//   return res?.data?.data ?? null;
// }

// services/orderService.js
import { api } from "./apiClient";
import { fetchProductById } from "./productService"; // dùng hàm có sẵn

// ─── helpers ──────────────────────────────────────────────────────────────────

function pickData(res) {
  // GET /api/orders/me  →  { success, data: [...], pagination }
  // GET /api/orders     →  { success, data: [...], pagination }
  const raw = res?.data;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items; // fallback shape
  return [];
}

function pickPagination(res) {
  return (
    res?.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
  );
}

/**
 * Map một item trong mảng items[] của order sang shape thống nhất dùng trong UI.
 * API trả:
 *   { productId, variantId, name, type, quantity, unitPrice, lineTotal,
 *     depositPercent, payNow, payLater, preOrder }
 */
function normalizeOrderItem(raw) {
  return {
    // identity
    productId:  raw?.productId  ?? null,
    variantId:  raw?.variantId  ?? null,

    // display
    name:       raw?.name       ?? "Sản phẩm",

    // ── type: chuẩn hóa về "LENS" | "FRAME" | "OTHER"
    type:       raw?.type       ?? "OTHER",          // gốc từ API: "frame","lens","sunglasses",...
    productType: normalizeProductType(raw?.type),    // dùng cho modal logic

    // ── quantity / price: API dùng quantity + unitPrice
    qty:        raw?.quantity   ?? 1,
    quantity:   raw?.quantity   ?? 1,
    price:      raw?.unitPrice  ?? 0,
    unitPrice:  raw?.unitPrice  ?? 0,
    lineTotal:  raw?.lineTotal  ?? 0,

    // preorder
    preOrder:   raw?.preOrder   ?? false,
    preorder:   raw?.preOrder   ?? false,   // alias dùng trong OrderCard

    // deposit
    depositPercent: raw?.depositPercent ?? 100,
    payNow:     raw?.payNow     ?? 0,
    payLater:   raw?.payLater   ?? 0,

    // sẽ được enrich sau khi gọi /api/products/:id
    image:          null,
    productColors:  [],
    productSizes:   [],
    orderType:      "READY",   // không có trong order response, default
    rxOD:           null,
    rxOS:           null,
    rxPhoto:        null,
    variant:        raw?.variantId ? { variantId: raw.variantId } : null,
  };
}

function normalizeProductType(apiType) {
  const t = String(apiType || "").toLowerCase();
  if (t === "lens" || t === "contact_lens") return "LENS";
  if (t === "frame" || t === "sunglasses") return "FRAME";
  return "OTHER";
}

/**
 * Enrich một normalizedItem với dữ liệu product (ảnh, colors, sizes).
 * Gọi fetchProductById từ productService (đã có sẵn).
 */
async function enrichItemWithProduct(item) {
  if (!item?.productId) return item;
  try {
    const product = await fetchProductById(item.productId);
    if (!product) return item;

    return {
      ...item,
      image:         product.image         ?? null,
      productColors: product.colors        ?? [],
      productSizes:  product.sizes         ?? [],
    };
  } catch {
    return item; // nếu lỗi thì giữ nguyên, không crash
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Lấy danh sách đơn hàng của user hiện tại.
 * @param {object} params  – { page, limit }
 * @param {boolean} enrichProducts – gọi thêm /api/products/:id cho từng item để lấy ảnh
 */
export async function getMyOrdersApi(params = {}, enrichProducts = false) {
  const res = await api.get("/api/orders/me", { params });
  const rawOrders = pickData(res);
  const pagination = pickPagination(res);

  // Normalize tất cả items trong mỗi order
  let orders = rawOrders.map((order) => ({
    ...order,
    items: Array.isArray(order?.items)
      ? order.items.map(normalizeOrderItem)
      : [],
  }));

  // Nếu cần ảnh sản phẩm: enrich song song
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

/**
 * Lấy chi tiết 1 đơn hàng (có enrich ảnh mặc định).
 */
export async function getOrderByIdApi(orderId, enrichProducts = true) {
  const res = await api.get(`/api/orders/${orderId}`);
  const raw = res?.data?.data ?? null;
  if (!raw) return null;

  const order = {
    ...raw,
    items: Array.isArray(raw?.items)
      ? raw.items.map(normalizeOrderItem)
      : [],
  };

  if (!enrichProducts) return order;

  return {
    ...order,
    items: await Promise.all(order.items.map(enrichItemWithProduct)),
  };
}