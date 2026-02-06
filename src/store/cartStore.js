// store/cartStore.js
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY_BASE = "cart_v1";
const makeCartKey = (userKey) => (userKey ? `${CART_KEY_BASE}:${userKey}` : null);

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Tạo key để gộp dòng (cùng sản phẩm + cùng cấu hình)
function makeLineKey({ productId, orderType, variantKey, rxKey }) {
  return [productId, orderType || "READY", variantKey || "-", rxKey || "-"].join("|");
}

function isRxFilled(rxOD, rxOS) {
  const okEye = (eye) => {
    if (!eye) return false;
    const cyl = String(eye.CYL ?? "").trim();
    const axis = String(eye.AXIS ?? "").trim();
    return cyl.length > 0 && axis.length > 0;
  };
  return okEye(rxOD) && okEye(rxOS);
}

function pickProductSnapshot(p) {
  return {
    id: p.id,
    apiId: p.apiId || null,
    type: p.type, // "LENS" | "FRAME"
    name: p.name,
    image: p.image,
    price: p.price,
    originalPrice: p.originalPrice || null,
    status: p.status || null,
    discountPct: p.discountPct || null,
  };
}

export const useCartStore = create((set, get) => ({
  items: [],
  isHydrating: true,
  userKey: null,

  // gọi khi auth đổi user
  setUser: async (userKey) => {
    set({ userKey: userKey || null, isHydrating: true, items: [] });
    await get().hydrate();
  },

  hydrate: async () => {
    const key = makeCartKey(get().userKey);
    if (!key) {
      set({ items: [], isHydrating: false });
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(key);
      const data = safeJsonParse(raw, []);
      set({ items: Array.isArray(data) ? data : [], isHydrating: false });
    } catch {
      set({ items: [], isHydrating: false });
    }
  },

  _persist: async (items) => {
    const key = makeCartKey(get().userKey);
    if (!key) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch {}
  },

  clear: () => {
    const key = makeCartKey(get().userKey);
    set({ items: [] });
    if (key) AsyncStorage.removeItem(key).catch(() => {});
  },

  getTotalQty: () => get().items.reduce((sum, it) => sum + (it.qty || 0), 0),

  addItem: ({ product, orderType, qty, variant, rxOD, rxOS }) => {
    const pSnap = pickProductSnapshot(product);

    const variantKey =
      product.type === "FRAME"
        ? `c:${variant?.colorId || "-"}|s:${variant?.size || "-"}`
        : "-";

    const rxKey =
      product.type === "LENS"
        ? `od:${rxOD?.CYL || ""},${rxOD?.AXIS || ""}|os:${rxOS?.CYL || ""},${rxOS?.AXIS || ""}`
        : "-";

    const lineKey = makeLineKey({
      productId: product.id,
      orderType,
      variantKey,
      rxKey,
    });

    const variantText =
      product.type === "FRAME"
        ? `Màu: ${variant?.colorName || "—"}, Size: ${variant?.size || "—"}`
        : null;

    const prescriptionFilled = product.type === "LENS" ? isRxFilled(rxOD, rxOS) : false;
    const lensSelected = product.type === "LENS" ? true : false;

    set((state) => {
      const nextQty = Math.max(1, Math.min(99, qty || 1));
      const idx = state.items.findIndex((x) => x.key === lineKey);

      let nextItems = [];

      if (idx >= 0) {
        nextItems = state.items.map((x, i) =>
          i === idx ? { ...x, qty: Math.min(99, (x.qty || 0) + nextQty) } : x
        );
      } else {
        nextItems = [
          ...state.items,
          {
            key: lineKey,
            product: pSnap,
            orderType: orderType || "READY",
            qty: nextQty,
            variantText,
            variant: variant || null,
            rxOD: rxOD || null,
            rxOS: rxOS || null,
            prescriptionFilled,
            lensSelected,
          },
        ];
      }

      get()._persist(nextItems);
      return { items: nextItems };
    });
  },

  setQty: (key, qty) => {
    set((state) => {
      const next = state.items
        .map((x) => (x.key === key ? { ...x, qty: Math.max(1, Math.min(99, qty)) } : x))
        .filter((x) => (x.qty || 0) > 0);

      get()._persist(next);
      return { items: next };
    });
  },

  removeItem: (key) => {
    set((state) => {
      const next = state.items.filter((x) => x.key !== key);
      get()._persist(next);
      return { items: next };
    });
  },

  setFlags: (key, patch) => {
    set((state) => {
      const next = state.items.map((x) => (x.key === key ? { ...x, ...patch } : x));
      get()._persist(next);
      return { items: next };
    });
  },
}));
