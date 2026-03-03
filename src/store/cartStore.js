// store/cartStore.js
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY_BASE = "cart_v1";
const makeCartKey = (userKey) => (userKey ? `${CART_KEY_BASE}:${userKey}` : null);

export const CART_TYPES = {
  ORDER: "ORDER",
  PREORDER: "PREORDER",
};

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
    type: p.type,
    name: p.name,
    image: p.image,
    price: p.price,
    originalPrice: p.originalPrice || null,
    status: p.status || null,
    discountPct: p.discountPct || null,
    // keep minimal fields only
  };
}

function normalizeCartType(cartType, isPreorder) {
  if (cartType === CART_TYPES.PREORDER) return CART_TYPES.PREORDER;
  if (cartType === CART_TYPES.ORDER) return CART_TYPES.ORDER;
  return isPreorder ? CART_TYPES.PREORDER : CART_TYPES.ORDER;
}

function splitLegacyItems(items) {
  const orderItems = [];
  const preorderItems = [];

  for (const item of Array.isArray(items) ? items : []) {
    if (item?.isPreorder) preorderItems.push(item);
    else orderItems.push(item);
  }

  return { orderItems, preorderItems };
}

function resolveTargetCart(state, key, cartType) {
  if (cartType === CART_TYPES.ORDER || cartType === CART_TYPES.PREORDER) return cartType;

  const inOrder = state.items.some((x) => x.key === key);
  const inPreorder = state.preorderItems.some((x) => x.key === key);

  if (inPreorder && !inOrder) return CART_TYPES.PREORDER;
  return CART_TYPES.ORDER;
}

export const useCartStore = create((set, get) => ({
  items: [],
  preorderItems: [],
  isHydrating: true,
  userKey: null,

  setUser: async (userKey) => {
    set({ userKey: userKey || null, isHydrating: true, items: [], preorderItems: [] });
    await get().hydrate();
  },

  hydrate: async () => {
    const key = makeCartKey(get().userKey);
    if (!key) {
      set({ items: [], preorderItems: [], isHydrating: false });
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(key);
      const data = safeJsonParse(raw, []);

      // legacy: array only
      if (Array.isArray(data)) {
        const { orderItems, preorderItems } = splitLegacyItems(data);
        set({ items: orderItems, preorderItems, isHydrating: false });
        return;
      }

      const orderItems = Array.isArray(data?.orderItems) ? data.orderItems : [];
      const preorderItems = Array.isArray(data?.preorderItems) ? data.preorderItems : [];
      set({ items: orderItems, preorderItems, isHydrating: false });
    } catch {
      set({ items: [], preorderItems: [], isHydrating: false });
    }
  },

  _persist: async (orderItems, preorderItems) => {
    const key = makeCartKey(get().userKey);
    if (!key) return;

    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          orderItems: Array.isArray(orderItems) ? orderItems : [],
          preorderItems: Array.isArray(preorderItems) ? preorderItems : [],
        })
      );
    } catch {}
  },

  clear: (cartType) => {
    const key = makeCartKey(get().userKey);

    if (cartType === CART_TYPES.PREORDER) {
      set((state) => {
        get()._persist(state.items, []);
        return { preorderItems: [] };
      });
      return;
    }

    if (cartType === CART_TYPES.ORDER) {
      set((state) => {
        get()._persist([], state.preorderItems);
        return { items: [] };
      });
      return;
    }

    set({ items: [], preorderItems: [] });
    if (key) AsyncStorage.removeItem(key).catch(() => {});
  },

  getItems: (cartType) => {
    if (cartType === CART_TYPES.PREORDER) return get().preorderItems;
    if (cartType === CART_TYPES.ORDER) return get().items;
    return [...get().items, ...get().preorderItems];
  },

  getTotalQty: (cartType) => get().getItems(cartType).reduce((sum, it) => sum + (it.qty || 0), 0),

  addItem: ({ product, orderType, qty, variant, rxOD, rxOS, rxPhoto, isPreorder, cartType }) => {
    const pSnap = pickProductSnapshot(product);
    const ot = orderType || "READY";
    const target = normalizeCartType(cartType, isPreorder);

    const variantKey =
      product.type === "FRAME"
        ? `c:${variant?.colorId || "-"}|s:${variant?.size || "-"}`
        : "-";

    let rxKey = "-";
    if (product.type === "LENS") {
      const hasRx = isRxFilled(rxOD, rxOS);

      if (ot === "READY") {
        rxKey = `od:${rxOD?.CYL || ""},${rxOD?.AXIS || ""}|os:${rxOS?.CYL || ""},${rxOS?.AXIS || ""}`;
      } else if (ot === "CUSTOM") {
        rxKey = `photo:${rxPhoto?.uri || "-"}`;
      } else if (ot === "PREORDER") {
        rxKey = hasRx
          ? `od:${rxOD?.CYL || ""},${rxOD?.AXIS || ""}|os:${rxOS?.CYL || ""},${rxOS?.AXIS || ""}`
          : `photo:${rxPhoto?.uri || "-"}`;
      } else {
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
        ? `Mau: ${variant?.colorName || "-"}, Size: ${variant?.size || "-"}`
        : null;

    const prescriptionFilled =
      product.type === "LENS"
        ? ot === "READY"
          ? isRxFilled(rxOD, rxOS)
          : ot === "PREORDER"
          ? isRxFilled(rxOD, rxOS) || Boolean(rxPhoto?.uri)
          : Boolean(rxPhoto?.uri)
        : false;

    const lensSelected = product.type === "LENS";

    set((state) => {
      const nextQty = Math.max(1, Math.min(99, qty || 1));
      const baseItems = target === CART_TYPES.PREORDER ? state.preorderItems : state.items;
      const idx = baseItems.findIndex((x) => x.key === lineKey);

      let nextBucketItems = [];

      if (idx >= 0) {
        nextBucketItems = baseItems.map((x, i) =>
          i === idx
            ? {
                ...x,
                qty: Math.min(99, (x.qty || 0) + nextQty),
                rxOD: product.type === "LENS" ? rxOD || x.rxOD || null : x.rxOD,
                rxOS: product.type === "LENS" ? rxOS || x.rxOS || null : x.rxOS,
                rxPhoto: product.type === "LENS" ? rxPhoto || x.rxPhoto || null : x.rxPhoto,
                prescriptionFilled,
              }
            : x
        );
      } else {
        nextBucketItems = [
          ...baseItems,
          {
            key: lineKey,
            product: pSnap,
            orderType: ot,
            qty: nextQty,
            variantText,
            variant: variant || null,
            rxOD: rxOD || null,
            rxOS: rxOS || null,
            isPreorder: Boolean(isPreorder),
            rxPhoto: rxPhoto || null,
            prescriptionFilled,
            lensSelected,

            // ✅ pairing fields (persist local)
            pairWithKey: null,
            pairWithName: null,
          },
        ];
      }

      const nextOrderItems = target === CART_TYPES.ORDER ? nextBucketItems : state.items;
      const nextPreorderItems =
        target === CART_TYPES.PREORDER ? nextBucketItems : state.preorderItems;

      get()._persist(nextOrderItems, nextPreorderItems);
      return {
        items: nextOrderItems,
        preorderItems: nextPreorderItems,
      };
    });
  },

  setQty: (key, qty, cartType) => {
    set((state) => {
      const target = resolveTargetCart(state, key, cartType);
      const applyQty = (list) =>
        list
          .map((x) => (x.key === key ? { ...x, qty: Math.max(1, Math.min(99, qty)) } : x))
          .filter((x) => (x.qty || 0) > 0);

      const nextOrderItems = target === CART_TYPES.ORDER ? applyQty(state.items) : state.items;
      const nextPreorderItems =
        target === CART_TYPES.PREORDER ? applyQty(state.preorderItems) : state.preorderItems;

      get()._persist(nextOrderItems, nextPreorderItems);
      return { items: nextOrderItems, preorderItems: nextPreorderItems };
    });
  },

  removeItem: (key, cartType) => {
    set((state) => {
      const target = resolveTargetCart(state, key, cartType);

      const nextOrderItems =
        target === CART_TYPES.ORDER ? state.items.filter((x) => x.key !== key) : state.items;
      const nextPreorderItems =
        target === CART_TYPES.PREORDER
          ? state.preorderItems.filter((x) => x.key !== key)
          : state.preorderItems;

      get()._persist(nextOrderItems, nextPreorderItems);
      return { items: nextOrderItems, preorderItems: nextPreorderItems };
    });
  },

  setFlags: (key, patch, cartType) => {
    set((state) => {
      const target = resolveTargetCart(state, key, cartType);

      const nextOrderItems =
        target === CART_TYPES.ORDER
          ? state.items.map((x) => (x.key === key ? { ...x, ...patch } : x))
          : state.items;
      const nextPreorderItems =
        target === CART_TYPES.PREORDER
          ? state.preorderItems.map((x) => (x.key === key ? { ...x, ...patch } : x))
          : state.preorderItems;

      get()._persist(nextOrderItems, nextPreorderItems);
      return { items: nextOrderItems, preorderItems: nextPreorderItems };
    });
  },
}));