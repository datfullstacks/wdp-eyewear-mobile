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
    } catch { }
  },

  clear: () => {
    const key = makeCartKey(get().userKey);
    set({ items: [] });
    if (key) AsyncStorage.removeItem(key).catch(() => { });
  },

  getTotalQty: () => get().items.reduce((sum, it) => sum + (it.qty || 0), 0),

  addItem: ({ product, orderType, qty, variant, rxOD, rxOS, rxPhoto, isPreorder }) => {
    const pSnap = pickProductSnapshot(product);
    const ot = orderType || "READY";

    const variantKey =
      product.type === "FRAME"
        ? `c:${variant?.colorId || "-"}|s:${variant?.size || "-"}`
        : "-";

    let rxKey = "-";
    if (product.type === "LENS") {
      const hasRx = isRxFilled(rxOD, rxOS);
      const hasPhoto = Boolean(rxPhoto?.uri);

      if (ot === "READY") {
        rxKey = `od:${rxOD?.CYL || ""},${rxOD?.AXIS || ""}|os:${rxOS?.CYL || ""},${rxOS?.AXIS || ""}`;
      } else if (ot === "CUSTOM") {
        rxKey = `photo:${rxPhoto?.uri || "-"}`;
      } else if (ot === "PREORDER") {
        rxKey = hasRx
          ? `od:${rxOD?.CYL || ""},${rxOD?.AXIS || ""}|os:${rxOS?.CYL || ""},${rxOS?.AXIS || ""}`
          : `photo:${rxPhoto?.uri || "-"}`;
      } else {
        // fallback
        rxKey = hasRx
          ? `od:${rxOD?.CYL || ""},${rxOD?.AXIS || ""}|os:${rxOS?.CYL || ""},${rxOS?.AXIS || ""}`
          : `photo:${rxPhoto?.uri || "-"}`;
      }
    }

    const lineKey = makeLineKey({
      productId: product.id,
      orderType: ot,
      variantKey,
      rxKey,
    });

    const variantText =
      product.type === "FRAME"
        ? `Màu: ${variant?.colorName || "—"}, Size: ${variant?.size || "—"}`
        : null;

    // ✅ flags mới cho LENS:
    // READY: prescriptionFilled theo Rx
    // CUSTOM: prescriptionFilled theo photo
    // PREORDER: Rx OR photo
    const hasRx = product.type === "LENS" ? isRxFilled(rxOD, rxOS) : false;
    const hasPhoto = product.type === "LENS" ? Boolean(rxPhoto?.uri) : false;

    const prescriptionFilled =

      product.type === "LENS"
        ? (orderType === "READY" ? isRxFilled(rxOD, rxOS) : Boolean(rxPhoto?.uri))
        : false;

    const lensSelected = product.type === "LENS" ? true : false;

    set((state) => {
      const nextQty = Math.max(1, Math.min(99, qty || 1));
      const idx = state.items.findIndex((x) => x.key === lineKey);

      let nextItems = [];

      if (idx >= 0) {
        // ✅ nếu đã có line, tăng qty, đồng thời update rx/photo nếu cần
        nextItems = state.items.map((x, i) =>
          i === idx
            ? {
              ...x,
              qty: Math.min(99, (x.qty || 0) + nextQty),
              rxOD: product.type === "LENS" ? (rxOD || x.rxOD || null) : x.rxOD,
              rxOS: product.type === "LENS" ? (rxOS || x.rxOS || null) : x.rxOS,
              rxPhoto: product.type === "LENS" ? (rxPhoto || x.rxPhoto || null) : x.rxPhoto,
              prescriptionFilled,
            }
            : x
        );
      } else {
        nextItems = [
          ...state.items,
          {
            key: lineKey,
            product: pSnap,
            orderType: ot,
            qty: nextQty,
            variantText,
            variant: variant || null,
            rxOD: rxOD || null,
            rxOS: rxOS || null,
            isPreorder: Boolean(isPreorder), // ✅ NEW
            rxPhoto: rxPhoto || null,
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
