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

function isRxFilled(rxOD, rxOS) {
  const okOD = Boolean(rxOD?.CYL) && Boolean(rxOD?.AXIS);
  const okOS = Boolean(rxOS?.CYL) && Boolean(rxOS?.AXIS);
  return okOD && okOS;
}

function buildPrescription(it) {
  const orderType = it?.orderType || "READY";
  const rxOD = it?.rxOD || null;
  const rxOS = it?.rxOS || null;
  const photoUrl = it?.rxPhotoAssetId || it?.rxPhoto?.uri || null;

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
      const orderType = it.orderType || "READY";
      const variantId =
        it.variantId || it.variant?.id || it.variant?.variantId || null;

      const selectedColor =
        it.variant?.colorName || it.variant?.color || it.variant?.colorId || null;
      const selectedSize =
        it.variant?.size || null;

      const payload = {
        productId,
        product_id: productId,
        quantity,
        orderType,
      };

      if (variantId) {
        payload.variantId = variantId;
        payload.variant_id = variantId;
      }

      const customization = {
        selectedColor: selectedColor || undefined,
        selectedSize: selectedSize || undefined,
        note:
          orderType === "READY" && it?.readyNote
            ? String(it.readyNote).trim()
            : undefined,
      };

      if (it.product?.type === "LENS") {
        customization.prescription = buildPrescription(it);
      }

      const hasCustomization =
        Object.values(customization).some((v) => v !== undefined && v !== null);

      if (hasCustomization) {
        payload.customization = customization;
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
  voucherCode,
  cartType,
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
  if (voucherCode) payload.voucherCode = voucherCode;
  if (cartType) payload.cartType = cartType;
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
