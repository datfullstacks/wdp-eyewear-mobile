import { api } from "./apiClient";
import { productRequiresLensRxFlow } from "./productService";
import {
  buildLensPrescriptionPayload,
  normalizeLensPrescriptionDraft,
} from "./lensPrescriptionService";

function toText(value) {
  if (value == null) return "";
  return String(value);
}

function compactAddress(address) {
  if (!address) return null;
  const provinceId = Number(address.provinceId);
  const districtId = Number(address.districtId);
  return {
    fullName: address.fullName || "",
    phone: address.phone || "",
    email: address.email || "",
    line1: address.line1 || "",
    line2: address.line2 || "",
    ward: address.ward || "",
    wardCode: address.wardCode || "",
    district: address.district || "",
    districtId:
      Number.isInteger(districtId) && districtId > 0 ? districtId : undefined,
    province: address.province || "",
    provinceId:
      Number.isInteger(provinceId) && provinceId > 0 ? provinceId : undefined,
    country: address.country || "VN",
    note: address.note || "",
  };
}

function normalizeEyePayload(eye = {}) {
  return {
    sphere: toText(eye?.sphere ?? eye?.SPH),
    cyl: toText(eye?.cyl ?? eye?.CYL),
    axis: toText(eye?.axis ?? eye?.AXIS),
    add: toText(eye?.add ?? eye?.ADD),
  };
}

function hasManualPrescriptionValues(prescription = {}) {
  const rightEye = prescription?.rightEye || {};
  const leftEye = prescription?.leftEye || {};

  return Boolean(
    toText(rightEye?.sphere) ||
    toText(rightEye?.cyl) ||
    toText(rightEye?.axis) ||
    toText(rightEye?.add) ||
    toText(leftEye?.sphere) ||
    toText(leftEye?.cyl) ||
    toText(leftEye?.axis) ||
    toText(leftEye?.add) ||
    toText(prescription?.pd)
  );
}

function resolveIsMyopicFlag(prescription, hasPayload) {
  if (typeof prescription?.isMyopic === "boolean") {
    return prescription.isMyopic;
  }

  return Boolean(hasPayload);
}

function normalizePrescriptionPayload(prescription = {}) {
  const attachmentUrls = Array.isArray(prescription?.attachmentUrls)
    ? prescription.attachmentUrls.map((item) => toText(item)).filter(Boolean)
    : [];
  const mode = toText(prescription?.mode || "none").toLowerCase() || "none";
  const normalizedMode = mode === "attachment" ? "upload" : mode;
  const rightEye = normalizeEyePayload(prescription?.rightEye);
  const leftEye = normalizeEyePayload(prescription?.leftEye);
  const pd = toText(prescription?.pd);
  const note = toText(prescription?.note);
  const hasManualValues = hasManualPrescriptionValues({
    rightEye,
    leftEye,
    pd,
  });

  if (normalizedMode === "upload") {
    return {
      mode: attachmentUrls.length > 0 ? "upload" : "none",
      isMyopic: attachmentUrls.length > 0
        ? resolveIsMyopicFlag(prescription, attachmentUrls.length > 0)
        : false,
      rightEye: normalizeEyePayload(),
      leftEye: normalizeEyePayload(),
      pd: "",
      note,
      attachmentUrls,
    };
  }

  if (normalizedMode === "manual") {
    return {
      mode: hasManualValues ? "manual" : "none",
      isMyopic: hasManualValues
        ? resolveIsMyopicFlag(prescription, hasManualValues)
        : false,
      rightEye,
      leftEye,
      pd,
      note,
      attachmentUrls: [],
    };
  }

  return {
    mode: "none",
    isMyopic: false,
    rightEye: normalizeEyePayload(),
    leftEye: normalizeEyePayload(),
    pd: "",
    note,
    attachmentUrls: [],
  };
}

function normalizeCombineWithPayload(combineWith = {}) {
  const productId = toText(combineWith?.productId);
  if (!productId) return undefined;

  return {
    productId,
    product_id: productId,
    variantId: toText(combineWith?.variantId),
    variant_id: toText(combineWith?.variantId),
    note: toText(combineWith?.note),
  };
}

function normalizeCustomizationPayload(customization = {}) {
  const normalized = {
    selectedColor: toText(customization?.selectedColor),
    selectedSize: toText(customization?.selectedSize),
    photochromic: Boolean(customization?.photochromic),
    note: toText(customization?.note),
    prescription: normalizePrescriptionPayload(customization?.prescription),
  };

  const combineWith = normalizeCombineWithPayload(customization?.combineWith);
  if (combineWith) normalized.combineWith = combineWith;

  return normalized;
}

function buildPrescription(it) {
  const existingPrescription = it?.customization?.prescription;
  if (existingPrescription) {
    return normalizePrescriptionPayload(existingPrescription);
  }

  const orderType = it?.orderType || "READY";
  const rxOD = it?.rxOD || null;
  const rxOS = it?.rxOS || null;
  const photoUrl = it?.rxPhotoAssetId || it?.rxPhoto?.uri || null;
  const draft = normalizeLensPrescriptionDraft({
    rightEye: rxOD,
    leftEye: rxOS,
    pd: it?.pd,
    note: it?.readyNote,
    attachmentUrls: photoUrl ? [photoUrl] : [],
  });

  const method =
    orderType === "CUSTOM"
      ? "upload"
      : photoUrl && orderType === "PREORDER" && !rxOD && !rxOS
        ? "upload"
        : "manual";

  return normalizePrescriptionPayload(
    buildLensPrescriptionPayload({
      method,
      draft,
    })
  );
}

export function buildCheckoutItems(items = []) {
  return items
    .map((it) => {
      const productId =
        it.product?.apiId ||
        it.product?._id ||
        it.product?.id ||
        it.productId ||
        it.id;

      if (!productId) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // console.warn("checkout item missing productId", it);
        }
        return null;
      }

      const rawQty = Number(it.qty ?? it.quantity ?? 1);
      const quantity = Number.isFinite(rawQty)
        ? Math.max(1, Math.floor(rawQty))
        : 1;
      const orderType = it.orderType || "READY";
      const variantId =
        it.variantId || it.variant?._id || it.variant?.id || it.variant?.variantId || null;

      const selectedColor =
        it.customization?.selectedColor ||
        it.variant?.colorName ||
        it.variant?.color ||
        it.variant?.colorId ||
        null;
      const selectedSize =
        it.customization?.selectedSize || it.variant?.size || null;

      return {
        productId: String(productId),
        product_id: String(productId),
        variantId: variantId ? String(variantId) : undefined,
        variant_id: variantId ? String(variantId) : undefined,
        quantity,
        customization: normalizeCustomizationPayload({
          selectedColor,
          selectedSize,
          photochromic: it?.customization?.photochromic,
          note:
            it?.customization?.note ??
            (orderType === "READY" && it?.readyNote ? String(it.readyNote).trim() : ""),
          combineWith: it?.customization?.combineWith,
          prescription:
            productRequiresLensRxFlow(it?.product)
              ? buildPrescription(it)
              : it?.customization?.prescription,
        }),
      };
    })
    .filter(Boolean);
}

export function buildCheckoutPayload({
  items,
  shippingMethod,
  shippingAddress,
  storeId,
  note,
  shippingFee,
  discountAmount,
  voucherCode,
  paymentMethod,
  cartType,
}) {
  const payload = {
    items: buildCheckoutItems(items),
  };

  if (shippingMethod) payload.shippingMethod = shippingMethod;
  if (shippingAddress) payload.shippingAddress = compactAddress(shippingAddress);
  if (storeId) payload.storeId = storeId;
  if (note) payload.note = note;
  if (typeof shippingFee === "number") payload.shippingFee = shippingFee;
  if (typeof discountAmount === "number") payload.discountAmount = discountAmount;
  if (voucherCode) payload.voucherCode = voucherCode;
  if (paymentMethod) payload.paymentMethod = paymentMethod;
  if (cartType) payload.cartType = cartType;

  return payload;
}

export async function fetchCheckoutQuote(payload) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // console.log("api/checkout/quote payload", payload);
  }
  const res = await api.post("/api/checkout/quote", payload);
  return res?.data?.data || res?.data || {};
}

export async function createCheckout(payload) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // console.log("api/checkout payload", payload);
  }
  const res = await api.post("/api/checkout", payload);
  return res?.data?.data || res?.data || {};
}
