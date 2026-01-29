// store/cartStore.js
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "cart_v1";

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
  // Tuỳ bạn bắt buộc field nào. Hiện UI detail đang nhập CYL + AXIS cho mỗi mắt.
  const okEye = (eye) => {
    if (!eye) return false;
    const cyl = String(eye.CYL ?? "").trim();
    const axis = String(eye.AXIS ?? "").trim();
    return cyl.length > 0 && axis.length > 0;
  };
  return okEye(rxOD) && okEye(rxOS);
}

function pickProductSnapshot(p) {
  // Lưu snapshot để Cart hiển thị ổn định
  return {
    id: p.id,
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

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const data = safeJsonParse(raw, []);
      set({ items: Array.isArray(data) ? data : [], isHydrating: false });
    } catch {
      set({ items: [], isHydrating: false });
    }
  },

  _persist: async (items) => {
    try {
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
  },

  getTotalQty: () => {
    return get().items.reduce((sum, it) => sum + (it.qty || 0), 0);
  },

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

    // Theo UI Cart: cần nhập đơn kính + chọn tròng trước checkout :contentReference[oaicite:3]{index=3}
    // - Nếu là LENS: coi như "tròng" đã chọn rồi (lensSelected = true).
    // - prescriptionFilled: true nếu nhập đủ OD/OS
    const prescriptionFilled =
      product.type === "LENS" ? isRxFilled(rxOD, rxOS) : false;

    const lensSelected = product.type === "LENS" ? true : false;

    set((state) => {
      const nextQty = Math.max(1, Math.min(99, qty || 1));
      const idx = state.items.findIndex((x) => x.key === lineKey);

      let nextItems = [];

      if (idx >= 0) {
        // gộp qty
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
            variant: variant || null, // lưu colorId/size cho FRAME
            rxOD: rxOD || null, // lưu RX cho LENS
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

  clear: () => {
    set({ items: [] });
    AsyncStorage.removeItem(CART_KEY).catch(() => {});
  },
}));
