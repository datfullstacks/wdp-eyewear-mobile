import { api } from "./apiClient";

function compactAddress(address) {
  if (!address) return null;
  return {
    fullName: address.fullName || "",
    phone: address.phone || "",
    email: address.email || "",
    line1: address.line1 || "",
    line2: address.line2 || "",
    ward: address.ward || "",
    district: address.district || "",
    province: address.province || "",
    country: address.country || "VN",
    note: address.note || "",
  };
}

export function buildCheckoutItems(items = []) {
  return items
    .map((it) => {
      const productId =
        it.product?.apiId || it.product?._id || it.product?.id || it.productId || it.id;

      if (!productId) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("checkout item missing productId", it);
        }
        return null;
      }

      const rawQty = Number(it.qty ?? it.quantity ?? 1);
      const quantity = Number.isFinite(rawQty) ? Math.max(1, Math.floor(rawQty)) : 1;

      const payload = {
        productId,
        product_id: productId,
        quantity,
        orderType: it.orderType, // ✅ add
      };

      const variantId = it.variantId || it.variant?.id || null;
      if (variantId) {
        payload.variantId = variantId;
        payload.variant_id = variantId;
      }

      // ✅ attach lens data
      if (it.product?.type === "LENS") {
        if (it.orderType === "READY") {
          payload.rx = { od: it.rxOD || {}, os: it.rxOS || {} };
        } else {
          // ideally should be assetId after upload
          payload.rxPhoto = it.rxPhotoAssetId || it.rxPhoto?.uri || null;
        }
      } else {
        // ✅ READY note for all types
        if (it.orderType === "READY" && it.readyNote) {
          payload.readyNote = it.readyNote;
        }
      }

      return payload;
    })
    .filter(Boolean);
}

export function buildCheckoutPayload({
  items,
  shippingMethod,
  shippingAddress,
  note,
  shippingFee,
  discountAmount,
  paymentMethod,
}) {
  const payload = {
    items: buildCheckoutItems(items),
  };

  if (shippingMethod) payload.shippingMethod = shippingMethod;
  if (shippingAddress) payload.shippingAddress = compactAddress(shippingAddress);
  if (note) payload.note = note;
  if (typeof shippingFee === "number") payload.shippingFee = shippingFee;
  if (typeof discountAmount === "number") payload.discountAmount = discountAmount;
  if (paymentMethod) payload.paymentMethod = paymentMethod;

  return payload;
}

export async function fetchCheckoutQuote(payload) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("api/checkout/quote payload", payload);
  }
  const res = await api.post("/api/checkout/quote", payload);
  return res?.data?.data || res?.data || {};
}

export async function createCheckout(payload) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("api/checkout payload", payload);
  }
  const res = await api.post("/api/checkout", payload);
  return res?.data?.data || res?.data || {};
}