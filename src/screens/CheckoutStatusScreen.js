import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { CART_TYPES, useCartStore } from "../store/cartStore";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/apiClient";
import { cancelOrderApi } from "../services/orderService";
import {
  API_CART_TYPES,
  clearCartApi,
  refreshCartBadgeQty,
} from "../services/cartService";

const PALETTE = {
  navy: "#0c2c5c",
  navySoft: "#17365D",
  navyTint: "#EEF3F8",
  gold: "#ddad32",
  goldSoft: "#F5E9C8",
  white: "#FFFFFF",
  bg: "#F7F8FA",
  text: "#162033",
  muted: "#6B7280",
  border: "#E3E8EF",
};

const PAYMENT_STATUS_META = {
  PENDING_QR: {
    label: "Chờ thanh toán",
    desc: "Vui lòng quét mã QR để đặt cọc.",
    color: PALETTE.gold,
    bg: PALETTE.goldSoft,
  },
  PENDING_COD: {
    label: "Thanh toán khi nhận hàng",
    desc: "Thanh toán phần còn lại khi nhận hàng (COD).",
    color: PALETTE.navy,
    bg: PALETTE.navyTint,
  },
  PAID: {
    label: "Đã thanh toán",
    desc: "Hệ thống đã ghi nhận giao dịch.",
    color: "#15803D",
    bg: "#ECFDF5",
  },
  FAILED: {
    label: "Thanh toán thất bại",
    desc: "Giao dịch không thành công. Vui lòng thử lại.",
    color: "#991B1B",
    bg: "#FEE2E2",
  },
  EXPIRED: {
    label: "QR hết hạn",
    desc: "Mã QR đã hết hạn. Vui lòng tạo lại.",
    color: PALETTE.muted,
    bg: PALETTE.border,
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    desc: "Giao dịch đã được hoàn tiền.",
    color: PALETTE.navy,
    bg: PALETTE.navyTint,
  },
};

const REFUND_STATUS_META = {
  requested: {
    label: "Đã gửi yêu cầu",
    desc: "Yêu cầu hoàn tiền đã được ghi nhận và đang chờ nhân viên tiếp nhận.",
    color: PALETTE.gold,
    bg: PALETTE.goldSoft,
  },
  reviewing: {
    label: "Đang kiểm tra",
    desc: "Nhân viên đang kiểm tra thông tin hoàn tiền của bạn.",
    color: PALETTE.navy,
    bg: PALETTE.navyTint,
  },
  waiting_customer_info: {
    label: "Cần bổ sung",
    desc: "Vui lòng bổ sung thêm thông tin/chứng từ cho yêu cầu hoàn tiền.",
    color: PALETTE.gold,
    bg: PALETTE.goldSoft,
  },
  escalated_to_manager: {
    label: "Chờ quảng lý phê duyệt",
    desc: "Yêu cầu đang được chuyển đến quảng lý để phê duyệt thêm.",
    color: "#991B1B",
    bg: "#FEE2E2",
  },
  approved: {
    label: "Đã duyệt",
    desc: "Yêu cầu hoàn tiền đã được duyệt. Nhân viên đang chuẩn bị xử lý chuyển khoản.",
    color: "#15803D",
    bg: "#ECFDF5",
  },
  return_pending: {
    label: "Chờ trả hàng",
    desc: "Yêu cầu cần xác nhận hàng hoàn trước khi tiếp tục chuyển khoản.",
    color: PALETTE.gold,
    bg: PALETTE.goldSoft,
  },
  return_received: {
    label: "Đã nhận hàng hoàn",
    desc: "Hàng hoàn đã được xác nhận. Nhân viên sẽ tiếp tục xử lý hoàn tiền.",
    color: PALETTE.navy,
    bg: PALETTE.navyTint,
  },
  processing: {
    label: "Đang hoàn tiền",
    desc: "Nhân viên đang xử lý giao dịch hoàn tiền cho bạn.",
    color: PALETTE.navy,
    bg: PALETTE.navyTint,
  },
  completed: {
    label: "Hoàn tất",
    desc: "Yêu cầu hoàn tiền đã hoàn tất.",
    color: "#15803D",
    bg: "#ECFDF5",
  },
  rejected: {
    label: "Từ chối",
    desc: "Yêu cầu hoàn tiền đã bị từ chối. Xem ghi chú để biết thêm chi tiết.",
    color: "#991B1B",
    bg: "#FEE2E2",
  },
};

const ORDER_STEPS = [
  { key: "CONFIRMED", label: "Xác nhận", desc: "Đơn hàng đang được xác nhận" },
  {
    key: "AWAITING_STOCK",
    label: "Chờ hàng về",
    desc: "Đang chờ sản phẩm về kho",
  },
  { key: "PACKING", label: "Đóng gói", desc: "Đơn hàng đang được đóng gói" },
  { key: "SHIPPING", label: "Giao hàng", desc: "Đơn hàng đang được giao" },
  { key: "DELIVERED", label: "Hoàn tất", desc: "Đơn hàng đã được giao" },
];

const UI_TO_API_CART_TYPE = {
  [CART_TYPES.ORDER]: API_CART_TYPES.READY_STOCK,
  [CART_TYPES.PREORDER]: API_CART_TYPES.PRE_ORDER,
};

const formatVND = (value) =>
  new Intl.NumberFormat("vi-VN").format(value || 0) + "đ";

const SEPAY_FALLBACK_ACCOUNT_NUMBER =
  process.env.EXPO_PUBLIC_SEPAY_BANK_ACCOUNT_NUMBER ||
  process.env.EXPO_PUBLIC_SEPAY_BANK_ACCOUNT_ID ||
  null;
const SEPAY_FALLBACK_BANK_NAME =
  process.env.EXPO_PUBLIC_SEPAY_BANK_NAME || null;
const SEPAY_FALLBACK_ACCOUNT_NAME =
  process.env.EXPO_PUBLIC_SEPAY_BANK_ACCOUNT_NAME || null;

const formatDateTime = (value) => {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
};

const makeQrUrl = (content) => {
  if (!content) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    content
  )}`;
};

const isHttpUrl = (value) => /^https?:\/\/.+/i.test(value);
const isDataImageUrl = (value) =>
  /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);

const toTextValue = (value) => {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    if (typeof value.text === "string" && value.text.trim()) {
      return value.text.trim();
    }
    if (typeof value.description === "string" && value.description.trim()) {
      return value.description.trim();
    }
    if (typeof value.content === "string" && value.content.trim()) {
      return value.content.trim();
    }

    try {
      const serialized = JSON.stringify(value);
      return serialized === "{}" ? null : serialized;
    } catch {
      return null;
    }
  }

  return String(value);
};

const firstTextValue = (...values) => {
  for (const value of values) {
    const text = toTextValue(value);
    if (text) return text;
  }
  return null;
};

const toQrImageUrl = (value) => {
  const text = toTextValue(value);
  if (!text) return null;
  return isDataImageUrl(text) || isHttpUrl(text) ? text : null;
};

const firstQrImageUrl = (...values) => {
  for (const value of values) {
    const imageUrl = toQrImageUrl(value);
    if (imageUrl) return imageUrl;
  }
  return null;
};

const buildSepayQrUrl = ({ accountNumber, bankName, amount, description }) => {
  if (!accountNumber || !bankName) return null;

  const params = [
    `acc=${encodeURIComponent(accountNumber)}`,
    `bank=${encodeURIComponent(bankName)}`,
  ];

  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    params.push(`amount=${Math.round(amount)}`);
  }

  if (description) {
    params.push(`des=${encodeURIComponent(description)}`);
  }

  return `https://qr.sepay.vn/img?${params.join("&")}`;
};

const buildQrImageSource = (uri) => {
  const text = toTextValue(uri);
  if (!text) return null;

  if (/^https?:\/\/qr\.sepay\.vn\//i.test(text)) {
    return {
      uri: text,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    };
  }

  return { uri: text };
};

const buildAddressLines = (addr) => {
  if (!addr) return [];

  const lines = [];
  if (addr.line1) lines.push(addr.line1);

  const line2 = [addr.line2, addr.ward, addr.district, addr.province]
    .filter(Boolean)
    .join(", ");

  if (line2) lines.push(line2);

  const country = addr.country || "VN";
  if (country) lines.push(country === "VN" ? "Việt Nam" : country);

  return lines;
};

const normalizePaymentMethod = (value, payNow = 0) => {
  const method = String(value || "")
    .trim()
    .toUpperCase();
  if (!method) return payNow > 0 ? "SEPAY" : "COD";
  if (["VNPAY", "VNPAY_QR", "VNPAYQR", "VN_PAY"].includes(method))
    return "VNPAY";
  if (["SEPAY", "SE_PAY"].includes(method)) return "SEPAY";
  return method;
};

const normalizePaymentStatus = (
  status,
  { payNow = 0, method = "SEPAY" } = {}
) => {
  if (typeof status === "string" && PAYMENT_STATUS_META[status]) return status;

  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (["paid", "success", "succeeded", "completed", "complete"].includes(normalized)) {
    return "PAID";
  }
  if (normalized === "failed") return "FAILED";
  if (normalized === "refunded") return "REFUNDED";
  if (normalized === "expired") return "EXPIRED";
  if (normalized === "partial") return "PENDING_QR";
  if (normalized === "pending") {
    return method === "COD" || payNow <= 0 ? "PENDING_COD" : "PENDING_QR";
  }

  return method === "COD" || payNow <= 0 ? "PENDING_COD" : "PENDING_QR";
};

const isPlaceholderOrderId = (value) => {
  const id = String(value || "").trim();
  return !id || id === "OD--";
};

const normalizeOrderStatus = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "pending" || normalized === "confirmed")
    return "CONFIRMED";
  if (normalized === "processing") return "PACKING";
  if (normalized === "shipped") return "SHIPPING";
  if (normalized === "delivered") return "DELIVERED";
  if (normalized === "cancelled" || normalized === "canceled")
    return "CANCELLED";

  return String(status || "CONFIRMED").toUpperCase();
};

const normalizeShippingMethod = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "express") return "express";
  return "standard";
};

const normalizeRefundBreakdown = (
  value,
  fallbackItemAmount = 0,
  fallbackShippingFeeAmount = 0,
) => {
  const itemAmount = Number(value?.itemAmount ?? fallbackItemAmount ?? 0);
  const shippingFeeAmount = Number(
    value?.shippingFeeAmount ?? fallbackShippingFeeAmount ?? 0,
  );
  const returnShippingFeeAmount = Number(
    value?.returnShippingFeeAmount ?? 0,
  );
  const total = Number(
    value?.total ??
    itemAmount + shippingFeeAmount + returnShippingFeeAmount,
  );

  return {
    itemAmount,
    shippingFeeAmount,
    returnShippingFeeAmount,
    total,
  };
};

const normalizeRefundHistoryEntry = (entry) => ({
  action: String(entry?.action || "").trim().toLowerCase(),
  fromStatus: String(entry?.fromStatus || "none").trim().toLowerCase(),
  toStatus: String(entry?.toStatus || "none").trim().toLowerCase(),
  actorRole: String(entry?.actorRole || "").trim().toLowerCase(),
  actorName: String(entry?.actorName || "").trim(),
  note: String(entry?.note || "").trim(),
  createdAt: entry?.createdAt || null,
});

const normalizeRefund = (refund, { total = 0, shippingFee = 0 } = {}) => {
  const status = String(refund?.status || "")
    .trim()
    .toLowerCase();

  if (!status || status === "none") {
    return null;
  }

  const fallbackItemAmount = Math.max(Number(total || 0) - Number(shippingFee || 0), 0);
  const requestedBreakdown = normalizeRefundBreakdown(
    refund?.requestedBreakdown,
    fallbackItemAmount,
    0,
  );
  const approvedBreakdown = normalizeRefundBreakdown(
    refund?.approvedBreakdown,
    requestedBreakdown.itemAmount,
    requestedBreakdown.shippingFeeAmount,
  );

  return {
    status,
    reason: String(refund?.reason || "").trim(),
    responsibility: String(refund?.responsibility || "").trim(),
    requiresReturn: Boolean(refund?.requiresReturn),
    amount:
      Number(refund?.amount || 0) ||
      approvedBreakdown.total ||
      requestedBreakdown.total,
    requestedBreakdown,
    approvedBreakdown,
    requestedAt: refund?.requestedAt || null,
    approvedAt: refund?.approvedAt || null,
    processedAt: refund?.processedAt || null,
    rejectReason: String(refund?.rejectReason || "").trim(),
    decisionNote: String(refund?.decisionNote || "").trim(),
    contactNote: String(refund?.contactNote || "").trim(),
    escalateReason: String(refund?.escalateReason || "").trim(),
    transactionRef: String(refund?.transactionRef || "").trim(),
    currentOwnerRole: String(refund?.currentOwnerRole || "none")
      .trim()
      .toLowerCase(),
    nextActionCode: String(refund?.nextActionCode || "")
      .trim()
      .toLowerCase(),
    inspectionStatus: String(refund?.inspectionStatus || "not_required")
      .trim()
      .toLowerCase(),
    inspectionNote: String(refund?.inspectionNote || "").trim(),
    inspectionAt: refund?.inspectionAt || null,
    returnShipmentCode: String(refund?.returnShipmentCode || "").trim(),
    returnCarrier: String(refund?.returnCarrier || "").trim(),
    returnReceivedAt: refund?.returnReceivedAt || null,
    payoutProofUrl: String(refund?.payoutProofUrl || "").trim(),
    bankAccount: refund?.bankAccount || null,
    evidence: Array.isArray(refund?.evidence)
      ? refund.evidence
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
      : [],
    history: Array.isArray(refund?.history)
      ? refund.history.map(normalizeRefundHistoryEntry)
      : [],
  };
};

const getRefundOwnerLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "sales") return "Nhân viên bán hàng";
  if (normalized === "manager") return "Quản lý";
  if (normalized === "operations") return "Bộ phận nhận hàng hoàn";
  if (normalized === "customer") return "Bạn";
  return "Đã đóng yêu cầu";
};

const getRefundNextStepLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "customer_submit_info") return "Bạn bổ sung thông tin";
  if (normalized === "manager_approve") return "Đang chờ phê duyệt thêm";
  if (normalized === "confirm_return_received") {
    return "Đang chờ xác nhận hàng hoàn";
  }
  if (normalized === "start_processing") return "Nhân viên đang chuẩn bị chuyển khoản";
  if (normalized === "complete") return "Nhân viên xác nhận đã chuyển tiền";
  if (normalized === "start_review") return "Nhân viên đang xem xét hồ sơ";
  return "--";
};

const getRefundInspectionLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pending") return "Đang đối soát";
  if (normalized === "passed") return "Đã đạt";
  if (normalized === "failed") return "Không đạt";
  return "Không yêu cầu";
};

const getShippingMethodLabel = (value) => {
  const normalized = normalizeShippingMethod(value);
  if (normalized === "express") return "Giao nhanh";
  return "Giao tiêu chuẩn";
};

const getShippingCollectionTimingLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "with_balance") return "Thu khi giao hàng";
  if (normalized === "on_delivery") return "Thu khi giao hàng";
  return "Thu ngay";
};

const getShippingFeeModeLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "estimated" ? "Tạm tính" : "Giá thanh toán";
};

const mergeOrderSnapshot = (localOrder = {}, serverOrder = {}) => {
  const localBreakdown = localOrder.breakdown || {};
  const localPayment = localOrder.payment || {};
  const serverPayment = serverOrder.payment || {};
  const nextPaymentStatus =
    serverOrder.paymentStatus || serverPayment.status || localPayment.status;

  const inferredPaidAt =
    String(nextPaymentStatus || "").toLowerCase() === "paid"
      ? serverOrder.updatedAt ||
      serverOrder.createdAt ||
      localPayment.paidAt ||
      null
      : localPayment.paidAt || null;

  return {
    ...localOrder,
    ...serverOrder,
    orderId:
      serverOrder._id ||
      serverOrder.id ||
      serverOrder.orderId ||
      localOrder.orderId ||
      localOrder.id,
    code: serverOrder.code || localOrder.code,
    shippingMethod:
      serverOrder.shippingMethod ||
      serverOrder.shipping_method ||
      localOrder.shippingMethod ||
      localOrder.shipping_method ||
      null,
    breakdown: {
      subtotal: serverOrder.subtotal ?? localBreakdown.subtotal,
      shippingFee: serverOrder.shippingFee ?? localBreakdown.shippingFee,
      discountAmount:
        serverOrder.discountAmount ?? localBreakdown.discountAmount,
      total: serverOrder.total ?? localBreakdown.total,
      payNow:
        serverOrder.payNowTotal ?? serverOrder.payNow ?? localBreakdown.payNow,
      payLater:
        serverOrder.payLaterTotal ??
        serverOrder.payLater ??
        localBreakdown.payLater,
      payNowMethod:
        serverOrder.payNowMethod ||
        localBreakdown.payNowMethod ||
        serverOrder.paymentMethod ||
        localOrder.paymentMethod,
      payLaterMethod:
        serverOrder.payLaterMethod || localBreakdown.payLaterMethod,
      shippingFeeMode:
        serverOrder.shippingFeeMode || localBreakdown.shippingFeeMode,
      shippingCollectionTiming:
        serverOrder.shippingCollectionTiming ||
        localBreakdown.shippingCollectionTiming,
    },
    payment: {
      ...localPayment,
      ...serverPayment,
      method:
        serverPayment.method ||
        serverOrder.paymentMethod ||
        localPayment.method,
      status: nextPaymentStatus,
      amount:
        serverPayment.amount ?? serverOrder.payNowTotal ?? localPayment.amount,
      paymentCode:
        serverPayment.paymentCode ||
        serverPayment.code ||
        serverOrder.paymentCode ||
        localPayment.paymentCode,
      content:
        serverPayment.content ||
        serverOrder.paymentCode ||
        localPayment.content,
      bankAccountId:
        serverPayment.bankAccountId ||
        serverPayment.bank_account_id ||
        serverOrder.bankAccountId ||
        localPayment.bankAccountId,
      bankAccountNumber:
        serverPayment.bankAccountNumber ||
        serverPayment.bank_account_number ||
        serverOrder.bankAccountNumber ||
        localPayment.bankAccountNumber,
      bankName:
        serverPayment.bankName ||
        serverPayment.bank_name ||
        serverOrder.bankName ||
        localPayment.bankName,
      bankAccountName:
        serverPayment.bankAccountName ||
        serverPayment.bank_account_name ||
        serverOrder.bankAccountName ||
        localPayment.bankAccountName,
      qrUrl:
        serverPayment.qrUrl ||
        serverPayment.qr_url ||
        serverOrder.qrUrl ||
        localPayment.qrUrl,
      paidAt: serverPayment.paidAt || serverOrder.paidAt || inferredPaidAt,
    },
  };
};

const normalizeOrder = (raw) => {
  const breakdown = raw?.breakdown || {};
  const subtotal = breakdown.subtotal ?? raw?.subtotal ?? raw?.total ?? 0;
  const discountAmount =
    breakdown.discountAmount ?? raw?.discountAmount ?? raw?.discount ?? 0;
  const shippingFee = breakdown.shippingFee ?? raw?.shippingFee ?? 0;
  const total = breakdown.total ?? raw?.total ?? 0;
  const payNow = breakdown.payNow ?? raw?.payNow ?? raw?.payNowTotal ?? 0;
  const payLater =
    breakdown.payLater ??
    raw?.payLater ??
    raw?.payLaterTotal ??
    Math.max(0, total - payNow);
  const paidAmount = Number(raw?.paidAmount || 0);
  const unpaidAmount = Math.max(0, total - paidAmount);
  const shippingCollectionTiming =
    breakdown.shippingCollectionTiming ??
    raw?.shippingCollectionTiming ??
    "upfront";
  const shippingFeeMode =
    breakdown.shippingFeeMode ??
    raw?.shippingFeeMode ??
    "estimated";
  const payLaterMethod =
    firstTextValue(breakdown.payLaterMethod, raw?.payLaterMethod) ||
    (payLater > 0 ? "COD" : null);

  const payment = raw?.payment || {};
  const paymentMethod = normalizePaymentMethod(
    payment.method || breakdown.payNowMethod || raw?.paymentMethod,
    payNow
  );
  const paymentStatus = normalizePaymentStatus(
    raw?.paymentStatus || payment.status,
    {
      payNow,
      method: paymentMethod,
    }
  );

  const paymentCode = firstTextValue(
    payment.paymentCode,
    payment.transactionId,
    payment.code,
    payment.payment_code,
    payment.transaction_code
  );

  const paymentContent =
    firstTextValue(
      payment.content,
      payment.payload,
      payment.paymentContent,
      payment.text
    ) || paymentCode;

  const paymentAmount = payment.amount ?? payNow;
  const paymentCreatedAt = payment.createdAt || raw?.createdAt || null;
  const paymentPaidAt = payment.paidAt || raw?.paidAt || null;

  const paymentLink = firstTextValue(
    payment.paymentUrl,
    payment.payment_url,
    payment.checkoutUrl,
    payment.checkout_url,
    payment.payUrl,
    payment.pay_url,
    payment.url,
    payment.link
  );

  const qrCandidate = firstQrImageUrl(
    payment.qrUrl,
    payment.qr_url,
    payment.qrImage,
    payment.qr_image,
    payment.qr,
    payment.qrCode,
    payment.qr_code,
    payment.qrLink,
    payment.qr_link,
    raw?.qrUrl,
    raw?.qr_url
  );

  const paymentDescription =
    firstTextValue(
      payment.description,
      payment.note,
      payment.memo,
      payment.paymentNote,
      payment.payment_note,
      payment.content,
      payment.payment_content
    ) ||
    paymentContent ||
    paymentCode;

  const paymentAccountNumber = firstTextValue(
    payment.bankAccountNumber,
    payment.accountNumber,
    payment.bank_account_number,
    payment.acc,
    payment.account,
    payment.account_no,
    payment.account_number,
    raw?.bankAccountNumber,
    raw?.bank_account_number,
    raw?.accountNumber,
    raw?.account_number,
    payment.bankAccountId,
    payment.bank_account_id,
    raw?.bankAccountId,
    raw?.bank_account_id,
    paymentMethod === "SEPAY" ? SEPAY_FALLBACK_ACCOUNT_NUMBER : null
  );

  const paymentBankName = firstTextValue(
    payment.bankName,
    payment.bank,
    payment.bank_name,
    payment.bankCode,
    payment.bank_code,
    raw?.bankName,
    raw?.bank_name,
    paymentMethod === "SEPAY" ? SEPAY_FALLBACK_BANK_NAME : null
  );

  const paymentAccountName = firstTextValue(
    payment.bankAccountName,
    payment.bank_account_name,
    raw?.bankAccountName,
    raw?.bank_account_name,
    paymentMethod === "SEPAY" ? SEPAY_FALLBACK_ACCOUNT_NAME : null
  );

  const providerQrUrl =
    paymentMethod === "SEPAY"
      ? buildSepayQrUrl({
        accountNumber: paymentAccountNumber,
        bankName: paymentBankName,
        amount: paymentAmount,
        description: paymentDescription,
      })
      : null;

  const vnpayQrUrl =
    paymentMethod === "VNPAY" && paymentLink ? makeQrUrl(paymentLink) : null;

  const genericFallbackQrUrl =
    payNow > 0 && paymentMethod !== "SEPAY" && paymentMethod !== "VNPAY"
      ? makeQrUrl(paymentLink || paymentContent || paymentCode)
      : null;

  const qrUrl = firstQrImageUrl(
    qrCandidate,
    providerQrUrl,
    vnpayQrUrl,
    genericFallbackQrUrl
  );

  const bankAccountIdValue = firstTextValue(
    payment.bankAccountId,
    payment.bank_account_id
  );

  const rawAddress = raw?.shippingAddress || raw?.address || null;
  const address = rawAddress
    ? {
      fullName: rawAddress.fullName || rawAddress.name || "",
      phone: rawAddress.phone || "",
      email: rawAddress.email || "",
      line1: rawAddress.line1 || rawAddress.line || "",
      line2: rawAddress.line2 || "",
      ward: rawAddress.ward || "",
      district: rawAddress.district || "",
      province: rawAddress.province || "",
      country: rawAddress.country || "VN",
      note: rawAddress.note || "",
    }
    : null;

  return {
    orderId: raw?.orderId || raw?._id || raw?.code || raw?.id || "OD--",
    createdAt: raw?.createdAt || paymentCreatedAt,
    status: normalizeOrderStatus(raw?.status),
    shippingMethod: normalizeShippingMethod(
      raw?.shippingMethod || raw?.shipping_method
    ),
    paidAmount,
    unpaidAmount,
    address,
    totals: {
      subtotal,
      discountAmount,
      shippingFee,
      total,
      payNow,
      payLater,
      shippingCollectionTiming,
      shippingFeeMode,
    },
    payment: {
      method: paymentMethod,
      payLaterMethod,
      status: paymentStatus,
      amount: paymentAmount,
      paymentCode,
      content: paymentContent,
      description: paymentDescription,
      bankAccountId: bankAccountIdValue,
      bankAccountNumber: paymentAccountNumber,
      bankName: paymentBankName,
      bankAccountName: paymentAccountName,
      createdAt: paymentCreatedAt,
      paidAt: paymentPaidAt,
      paymentUrl: paymentLink,
      qrUrl,
    },
    refund: normalizeRefund(raw?.refund, { total, shippingFee }),
  };
};

export default function CheckoutStatusScreen({ navigation, route }) {
  const initialOrder = route?.params?.order || null;
  const cartType =
    route?.params?.cartType === CART_TYPES.PREORDER
      ? CART_TYPES.PREORDER
      : CART_TYPES.ORDER;

  const [serverOrder, setServerOrder] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const clearCart = useCartStore((s) => s.clear);
  const clearedRef = useRef(false);

  const rawOrder = useMemo(() => {
    if (initialOrder && serverOrder)
      return mergeOrderSnapshot(initialOrder, serverOrder);
    return serverOrder || initialOrder || null;
  }, [initialOrder, serverOrder]);

  const order = useMemo(() => normalizeOrder(rawOrder || {}), [rawOrder]);
  const hasOrderContext = Boolean(rawOrder);

  const pollOrderId = useMemo(() => {
    const id = rawOrder?._id || rawOrder?.id || rawOrder?.orderId;
    if (!id) return null;
    return String(id);
  }, [rawOrder]);

  const [paymentStatus, setPaymentStatus] = useState(order.payment.status);
  const [paidAt, setPaidAt] = useState(order.payment.paidAt || null);

  useEffect(() => {
    setPaymentStatus(order.payment.status);
    setPaidAt(order.payment.paidAt || null);
  }, [order.payment.status, order.payment.paidAt]);

  useEffect(() => {
    if (isPlaceholderOrderId(pollOrderId)) {
      return undefined;
    }

    let cancelled = false;

    const fetchOrder = async () => {
      try {
        const res = await api.get(`/api/orders/${pollOrderId}`);
        const data = res?.data?.data || res?.data || null;
        if (!cancelled && data) {
          setServerOrder(data);
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // console.log(
          //   "order polling failed",
          //   error?.response?.data || error?.message || error
          // );
        }
      }
    };

    fetchOrder();
    const timer = setInterval(fetchOrder, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollOrderId]);

  const paymentMeta =
    PAYMENT_STATUS_META[paymentStatus] || PAYMENT_STATUS_META.PENDING_QR;

  const isPaymentSettled =
    paymentStatus === "PAID" || paymentStatus === "REFUNDED";
  const isCodCheckout =
    String(order.payment.method || "").trim().toUpperCase() === "COD";
  const shouldShowSuccessActions = isPaymentSettled || isCodCheckout;
  const shouldClearCartAfterCheckout =
    paymentStatus === "PAID" || paymentStatus === "PENDING_COD";

  const shouldShowQr =
    Boolean(order.payment.qrUrl) &&
    !isPaymentSettled &&
    paymentStatus === "PENDING_QR";

  const qrImageSource = useMemo(
    () => buildQrImageSource(order.payment.qrUrl),
    [order.payment.qrUrl]
  );

  const canOpenPaymentUrl =
    Boolean(order.payment.paymentUrl) && !isPaymentSettled;

  const paymentMethodLabel =
    order.payment.method === "VNPAY"
      ? "VNPay"
      : order.payment.method === "SEPAY"
        ? "SePay"
        : order.payment.method || "QR";

  const shippingMethodLabel = getShippingMethodLabel(order.shippingMethod);

  const normalizedOrderStatus = String(order.status || "").toUpperCase();
  const rawOrderStatusKey = String(order.status || "")
    .trim()
    .toUpperCase();
  const isCancelledOrder = rawOrderStatusKey === "CANCELLED";
  const hasPaidAmount =
    Number(order.paidAmount || 0) > 0 ||
    ["PAID", "SUCCESS", "SUCCEEDED"].includes(String(paymentStatus || "").toUpperCase());

  const canCancelOrder =
    ["PENDING", "CONFIRMED", "PROCESSING"].includes(rawOrderStatusKey) &&
    !hasPaidAmount;
  const refundStatus = String(order.refund?.status || "")
    .trim()
    .toLowerCase();
  const hasClosedRefund =
    order.refund &&
    ["completed", "rejected"].includes(refundStatus);
  const hasActiveRefund = Boolean(order.refund && !hasClosedRefund);
  const rawPaidAmount = Math.max(0, Number(order.paidAmount || 0));
  const canCancelWithRefund =
    Boolean(pollOrderId) &&
    !hasActiveRefund &&
    rawOrderStatusKey === "PENDING" &&
    rawPaidAmount > 0;
  const refundMeta = order.refund
    ? REFUND_STATUS_META[refundStatus] || REFUND_STATUS_META.requested
    : null;
  const canSubmitRefundInfo =
    Boolean(pollOrderId) && refundStatus === "waiting_customer_info";
  const canRequestRefund =
    Boolean(pollOrderId) &&
    !hasActiveRefund &&
    ["CONFIRMED", "PROCESSING", "CANCELLED", "DELIVERED", "RETURNED"].includes(
      rawOrderStatusKey,
    ) &&
    rawPaidAmount > 0;
  const canOpenRefundForm = canRequestRefund || canSubmitRefundInfo;

  const navigateToTab = (tabName, screenName) => {
    navigation.navigate("Tabs", {
      screen: tabName,
      params: screenName ? { screen: screenName } : undefined,
    });
  };

  useEffect(() => {
    if (shouldClearCartAfterCheckout && !clearedRef.current) {
      clearedRef.current = true;
      const apiCartType =
        UI_TO_API_CART_TYPE[cartType] || API_CART_TYPES.READY_STOCK;

      (async () => {
        try {
          await clearCartApi(apiCartType);
        } catch (error) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            // console.log(
            //   "clear cart after checkout success failed",
            //   error?.response?.data || error?.message || error,
            // );
          }
        } finally {
          clearCart(cartType);
          await refreshCartBadgeQty().catch(() => { });
        }
      })();
    }
  }, [shouldClearCartAfterCheckout, clearCart, cartType]);

  const handleContinueShopping = () => navigateToTab("ProductsTab", "Products");

  const handleBackToHome = () => navigateToTab("HomeTab", "Home");
  const handleViewOrderDetail = () => {
    if (!isPlaceholderOrderId(pollOrderId)) {
      navigation.navigate("Tabs", {
        screen: "ProfileTab",
        params: {
          screen: "Orders",
          params: {
            initialFilter: "all",
            autoOpenOrderId: pollOrderId,
            source: "checkout_status",
          },
        },
      });
      return;
    }

    navigateToTab("ProfileTab", "Orders");
  };
  const handleRequestRefund = () => {
    if (!canOpenRefundForm) return;

    navigation.navigate("RefundRequest", {
      orderId: pollOrderId,
      order: rawOrder,
      cartType,
      refundAction: canSubmitRefundInfo ? "customer_submit_info" : undefined,
    });
  };

  const handleCancelPayment = () => {
    const orderId =
      rawOrder?._id ||
      rawOrder?.id ||
      initialOrder?._id ||
      initialOrder?.id ||
      rawOrder?.orderId ||
      initialOrder?.orderId ||
      null;

    if (isPlaceholderOrderId(orderId)) {
      Alert.alert("Không thể hủy", "Thiếu orderId hợp lệ.");
      return;
    }

    if (canCancelWithRefund) {
      navigation.navigate("RefundRequest", {
        orderId,
        order: rawOrder,
        cartType,
        refundAction: "cancel_order",
      });
      return;
    }

    Alert.alert(
      rawPaidAmount > 0 ? "Hủy đơn?" : "Hủy thanh toán?",
      rawPaidAmount > 0
        ? "Bạn chắc chắn muốn hủy đơn hàng này? Hệ thống sẽ tạo luồng hoàn tiền cho khoản đã thanh toán."
        : "Bạn chắc chắn muốn hủy thanh toán và hủy đơn hàng này? Thao tác không thể hoàn tác.",
      [
        { text: "Không", style: "cancel" },
        {
          text: "Hủy đơn",
          style: "destructive",
          onPress: async () => {
            try {
              setIsCancelling(true);

              const cancelledOrder = await cancelOrderApi(orderId);

              setServerOrder(
                cancelledOrder || {
                  ...(rawOrder || {}),
                  status: "cancelled",
                },
              );

              Alert.alert(
                "Thành công",
                rawPaidAmount > 0
                  ? "Đã hủy đơn hàng. Yêu cầu hoàn tiền đã được khởi tạo cho khoản đã thanh toán."
                  : "Đã hủy thanh toán và hủy đơn hàng.",
                [
                  {
                    text: "OK",
                  },
                ],
              );
            } catch (err) {
              const data = err?.response?.data || {};
              Alert.alert(
                "Hủy thất bại",
                data?.message ||
                data?.error ||
                err?.message ||
                "Không thể hủy đơn."
              );
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (!hasOrderContext) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() =>
                navigation?.canGoBack?.() ? navigation.goBack() : null
              }
              activeOpacity={0.85}
              style={styles.iconBtn}
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Trạng thái thanh toán</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Không tìm thấy đơn hàng</Text>
            <Text style={styles.mutedText}>
              Màn hình này cần được mở từ thanh toán hoặc từ một đơn hàng hợp lệ.
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnGhost]}
                activeOpacity={0.85}
                onPress={isCodCheckout ? handleBackToHome : handleContinueShopping}
              >
                <Text style={[styles.actionText, styles.actionTextGhost]}>
                  {isCodCheckout ? "Về trang chủ" : "Mua tiếp"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                activeOpacity={0.85}
                onPress={handleViewOrderDetail}
              >
                <Text style={[styles.actionText, styles.actionTextPrimary]}>
                  Xem đơn hàng
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() =>
              navigation?.canGoBack?.() ? navigation.goBack() : null
            }
            activeOpacity={0.85}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trạng thái thanh toán</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Đơn hàng {order.payment.paymentCode}</Text>
          <Text style={styles.subText}>
            Tạo lúc {formatDateTime(order.createdAt)}
          </Text>
          <View
            style={[styles.statusPill, { backgroundColor: paymentMeta.bg }]}
          >
            <Text style={[styles.statusText, { color: paymentMeta.color }]}>
              {paymentMeta.label}
            </Text>
          </View>
          <Text style={styles.descText}>{paymentMeta.desc}</Text>
        </View>

        {shouldShowQr ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              QR thanh toán {paymentMethodLabel}
            </Text>
            <Text style={styles.mutedText}>
              Quét mã để đặt cọc và hoàn tất đơn đặt trước.
            </Text>

            <View style={styles.qrWrap}>
              {qrImageSource ? (
                <Image source={qrImageSource} style={styles.qrImage} />
              ) : null}
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Số tiền cần chuyển</Text>
              <Text style={styles.metaValuePrice}>
                {formatVND(order.payment.amount)}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Mã thanh toán</Text>
              <Text style={styles.metaValue}>
                {order.payment.paymentCode || "--"}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Nội dung</Text>
              <Text style={styles.metaValue}>
                {order.payment.content ||
                  order.payment.paymentCode ||
                  order.payment.description ||
                  "--"}
              </Text>
            </View>

            {order.payment.bankAccountNumber || order.payment.bankAccountId ? (
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Tài khoản nhận</Text>
                <Text style={styles.metaValue}>
                  {order.payment.bankAccountNumber ||
                    order.payment.bankAccountId ||
                    "--"}
                </Text>
              </View>
            ) : null}

            {order.payment.bankName ? (
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Ngân hàng</Text>
                <Text style={styles.metaValue}>{order.payment.bankName}</Text>
              </View>
            ) : null}

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Thời gian tạo</Text>
              <Text style={styles.metaValue}>
                {formatDateTime(order.payment.createdAt)}
              </Text>
            </View>

            {(canCancelOrder || canCancelWithRefund) ? (
              <View style={styles.actionSection}>
                <Text style={styles.sectionTitle}>Thao tác</Text>
                <Text style={styles.mutedText}>
                  {canCancelWithRefund
                    ? "Nếu muốn hủy đơn đã thanh toán, vui lòng xác nhận tài khoản hoàn tiền trước khi gửi."
                    : "Nếu bạn không muốn tiếp tục thanh toán, có thể hủy đơn hàng này."}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.cancelBtn,
                    { marginTop: 12 },
                  ]}
                  activeOpacity={0.85}
                  disabled={isCancelling}
                  onPress={handleCancelPayment}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
                  <Text style={styles.cancelBtnText}>
                    {isCancelling
                      ? "Đang hủy..."
                      : canCancelWithRefund
                        ? "Hủy đơn và hoàn tiền"
                        : "Hủy thanh toán"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.backBtn,
                    { marginTop: 12 },
                  ]}
                  activeOpacity={0.85}
                  disabled={isCancelling}
                  onPress={handleBackToHome}
                >
                  {/* <Ionicons name="close-circle-outline" size={16} color={PALETTE.navy} /> */}
                  <Text style={styles.backBtnText}>
                    Trở về trang chủ
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : canOpenPaymentUrl ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Thanh toán {paymentMethodLabel}
            </Text>
            <Text style={styles.mutedText}>
              Không có ảnh QR hợp lệ từ hệ thống. Vui lòng mở liên kết thanh toán.
            </Text>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnPrimary,
                { marginTop: 12 },
              ]}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(order.payment.paymentUrl)}
            >
              <Text style={[styles.actionText, styles.actionTextPrimary]}>
                Mở liên kết thanh toán
              </Text>
            </TouchableOpacity>

            {(canCancelOrder || canCancelWithRefund) ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn, { marginTop: 10 }]}
                activeOpacity={0.85}
                disabled={isCancelling}
                onPress={handleCancelPayment}
              >
                <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
                <Text style={styles.cancelBtnText}>
                  {isCancelling
                    ? "Đang hủy..."
                    : canCancelWithRefund
                      ? "Hủy đơn và hoàn tiền"
                      : "Hủy thanh toán"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin thanh toán</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Phương thức</Text>
            <Text style={styles.metaValue}>
              {order.totals.payNow > 0
                ? order.payment.method || "--"
                : order.payment.payLaterMethod
                  ? String(order.payment.payLaterMethod).toUpperCase()
                  : order.payment.method || "--"}
            </Text>
          </View>

          {order.totals.payNow > 0 ? (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Thanh toán ngay</Text>
                <Text style={styles.metaValue}>
                  {formatVND(order.totals.payNow)}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>
                  Thanh toán sau
                  {order.payment.payLaterMethod
                    ? ` (${String(order.payment.payLaterMethod).toUpperCase()})`
                    : ""}
                </Text>
                <Text style={styles.metaValue}>
                  {formatVND(order.totals.payLater)}
                </Text>
              </View>
            </>
          ) : null}

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Phí giao hàng</Text>
            <Text style={styles.metaValue}>
              {getShippingFeeModeLabel(order.totals.shippingFeeMode)}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Thu phí giao hàng</Text>
            <Text style={styles.metaValue}>
              {getShippingCollectionTimingLabel(
                order.totals.shippingCollectionTiming,
              )}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Trạng thái</Text>
            <Text style={styles.metaValue}>{paymentMeta.label}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Thời gian giao dịch</Text>
            <Text style={styles.metaValue}>{formatDateTime(paidAt)}</Text>
          </View>
        </View>

        {shouldShowSuccessActions ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {isCodCheckout ? "Đặt hàng thành công!" : "Thanh toán thành công!"}
            </Text>
            <Text style={styles.mutedText}>
              {isCodCheckout
                ? "Đơn hàng COD đã được ghi nhận. Bạn có thể về trang chủ hoặc xem chi tiết đơn."
                : "Đơn hàng đã được ghi nhận. Bạn có thể mua tiếp hoặc xem chi tiết đơn."}
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.backBtn]}
                activeOpacity={0.85}
                onPress={handleBackToHome}
              >
                <Text style={[styles.actionText, styles.backBtnText]}>
                  Trở về trang chủ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                activeOpacity={0.85}
                onPress={handleViewOrderDetail}
              >
                <Text style={[styles.actionText, styles.actionTextPrimary]}>
                  Xem chi tiết
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {isCancelledOrder ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thanh toán đã bị hủy</Text>
            <Text style={styles.mutedText}>
              Đơn hàng này đã được hủy. Bạn có thể quay về giỏ hàng để tiếp tục
              chỉnh sửa hoặc đặt lại.
            </Text>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnPrimary,
                { marginTop: 12 },
              ]}
              activeOpacity={0.85}
              onPress={handleBackToHome}
            >
              <Text style={[styles.actionText, styles.actionTextPrimary]}>
                Quay về trang chủ
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {order.refund ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Trạng thái hoàn tiền</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: refundMeta?.bg || PALETTE.navyTint },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: refundMeta?.color || PALETTE.navy },
                ]}
              >
                {refundMeta?.label || "Đang xử lý"}
              </Text>
            </View>
            <Text style={styles.mutedText}>
              {refundMeta?.desc || "Yêu cầu hoàn tiền đang được xử lý."}
            </Text>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Tiền đề nghị hoàn</Text>
              <Text style={styles.metaValue}>
                {formatVND(
                  order.refund.requestedBreakdown.total || order.refund.amount,
                )}
              </Text>
            </View>

            {order.refund.approvedBreakdown.total > 0 ? (
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Tiền đã duyệt</Text>
                <Text style={styles.metaValue}>
                  {formatVND(order.refund.approvedBreakdown.total)}
                </Text>
              </View>
            ) : null}

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Ngày yêu cầu</Text>
              <Text style={styles.metaValue}>
                {formatDateTime(order.refund.requestedAt)}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Đã thanh toán</Text>
              <Text style={styles.metaValue}>{formatVND(order.paidAmount)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Chưa thu</Text>
              <Text style={styles.metaValue}>{formatVND(order.unpaidAmount)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Bước tiếp theo</Text>
              <Text style={styles.metaValue}>
                {getRefundNextStepLabel(order.refund.nextActionCode)}
              </Text>
            </View>

            {order.refund.processedAt ? (
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Ngày xử lý</Text>
                <Text style={styles.metaValue}>
                  {formatDateTime(order.refund.processedAt)}
                </Text>
              </View>
            ) : null}

            {order.refund.reason ? (
              <Text style={styles.refundNote}>Lý do: {order.refund.reason}</Text>
            ) : null}

            {order.refund.rejectReason ? (
              <Text style={styles.refundNote}>
                Lý do từ chối: {order.refund.rejectReason}
              </Text>
            ) : null}

            {order.refund.decisionNote ? (
              <Text style={styles.refundNote}>
                Ghi chú: {order.refund.decisionNote}
              </Text>
            ) : null}

            {order.refund.contactNote ? (
              <Text style={styles.refundNote}>
                Nhân viên yêu cầu: {order.refund.contactNote}
              </Text>
            ) : null}

            {order.refund.requiresReturn ||
              order.refund.returnShipmentCode ||
              order.refund.inspectionStatus !== "not_required" ? (
              <View style={styles.refundSubCard}>
                <Text style={styles.refundSubTitle}>Thông tin hoàn hàng & kiểm tra</Text>
                <Text style={styles.refundSubText}>
                  Kiểm tra: {getRefundInspectionLabel(order.refund.inspectionStatus)}
                </Text>
                {order.refund.inspectionNote ? (
                  <Text style={styles.refundSubText}>
                    Ghi chú kiểm tra: {order.refund.inspectionNote}
                  </Text>
                ) : null}
                {order.refund.inspectionAt ? (
                  <Text style={styles.refundSubText}>
                    Kiểm tra lúc: {formatDateTime(order.refund.inspectionAt)}
                  </Text>
                ) : null}
                {order.refund.returnCarrier ? (
                  <Text style={styles.refundSubText}>
                    Đơn vị hoàn: {String(order.refund.returnCarrier).toUpperCase()}
                  </Text>
                ) : null}
                {order.refund.returnShipmentCode ? (
                  <Text style={styles.refundSubText}>
                    Mã vận đơn trả: {order.refund.returnShipmentCode}
                  </Text>
                ) : null}
                {order.refund.returnReceivedAt ? (
                  <Text style={styles.refundSubText}>
                    Đã nhận hàng hoàn: {formatDateTime(order.refund.returnReceivedAt)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {order.refund.bankAccount?.accountNumber ? (
              <Text style={styles.refundNote}>
                Tài khoản nhận tiền: {order.refund.bankAccount.bankName || "--"} -{" "}
                {order.refund.bankAccount.accountNumber}
              </Text>
            ) : null}

            {order.totals.payLater > 0 ? (
              <Text style={styles.refundNote}>
                Hoàn tiền hiện tại chỉ áp dụng trên tiền cọc/tiền đã thanh toán.
              </Text>
            ) : null}

            {order.refund.transactionRef ? (
              <Text style={styles.refundNote}>
                Mã giao dịch hoàn tiền: {order.refund.transactionRef}
              </Text>
            ) : null}

            {order.refund.evidence?.length ? (
              <View style={styles.refundTimeline}>
                <Text style={styles.refundSubTitle}>Bằng chứng đã gửi</Text>
                <View style={styles.refundEvidenceRow}>
                  {order.refund.evidence.slice(0, 4).map((url, index) => (
                    <TouchableOpacity
                      key={`${url}-${index}`}
                      activeOpacity={0.85}
                      onPress={() => Linking.openURL(url).catch(() => { })}
                    >
                      <Image
                        source={{ uri: url }}
                        style={styles.refundEvidenceImage}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {order.refund.history?.length ? (
              <View style={styles.refundTimeline}>
                <Text style={styles.refundSubTitle}>Tiến trình hoàn tiền</Text>
                {order.refund.history
                  .slice()
                  .reverse()
                  .slice(0, 4)
                  .map((entry, index) => (
                    <View
                      key={`${entry.createdAt || entry.action || "refund"}-${index}`}
                      style={styles.refundTimelineItem}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.refundTimelineTitle}>
                          {entry.actorName ||
                            (entry.actorRole
                              ? getRefundOwnerLabel(entry.actorRole)
                              : "System")}
                        </Text>
                        <Text style={styles.refundTimelineTime}>
                          {formatDateTime(entry.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.refundTimelineMeta}>
                        {(entry.fromStatus || "none").toUpperCase()} {"->"}{" "}
                        {(entry.toStatus || "none").toUpperCase()}
                      </Text>
                      {entry.note ? (
                        <Text style={styles.refundTimelineMeta}>{entry.note}</Text>
                      ) : null}
                    </View>
                  ))}
              </View>
            ) : null}

            {canSubmitRefundInfo ? (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  { marginTop: 12 },
                ]}
                activeOpacity={0.85}
                onPress={handleRequestRefund}
              >
                <Text style={[styles.actionText, styles.actionTextPrimary]}>
                  Bổ sung thông tin hoàn tiền
                </Text>
              </TouchableOpacity>
            ) : canRequestRefund ? (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  { marginTop: 12 },
                ]}
                activeOpacity={0.85}
                onPress={handleRequestRefund}
              >
                <Text style={[styles.actionText, styles.actionTextPrimary]}>
                  Tạo yêu cầu hoàn tiền mới
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : canRequestRefund ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Yêu cầu hoàn tiền</Text>
            <Text style={styles.mutedText}>
              Nếu đơn hàng có vấn đề, bạn có thể gửi yêu cầu refund để nhân viên tiếp
              nhận và xử lý.
            </Text>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnPrimary,
                { marginTop: 12 },
              ]}
              activeOpacity={0.85}
              onPress={handleRequestRefund}
            >
              <Text style={[styles.actionText, styles.actionTextPrimary]}>
                Tạo yêu cầu hoàn tiền
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Phương thức giao hàng</Text>
            <Text style={styles.metaValue}>{shippingMethodLabel}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Tạm tính</Text>
            <Text style={styles.metaValue}>
              {formatVND(order.totals.subtotal)}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Giảm giá</Text>
            <Text style={styles.metaValue}>
              -{formatVND(order.totals.discountAmount)}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>
              Phí vận chuyển ({getShippingFeeModeLabel(order.totals.shippingFeeMode)})
            </Text>
            <Text style={styles.metaValue}>
              {formatVND(order.totals.shippingFee)}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Thu phí giao hàng</Text>
            <Text style={styles.metaValue}>
              {getShippingCollectionTimingLabel(
                order.totals.shippingCollectionTiming,
              )}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>
              {formatVND(order.totals.total)}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          <Text style={styles.addressName}>
            {order.address?.fullName || "--"}
          </Text>
          <Text style={styles.addressMeta}>{order.address?.phone || "--"}</Text>

          {order.address?.email ? (
            <Text style={styles.addressMeta}>{order.address.email}</Text>
          ) : null}

          {buildAddressLines(order.address).map((line, idx) => (
            <Text key={`${line}-${idx}`} style={styles.addressMeta}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },

  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingHorizontal: 16, paddingBottom: 20 },

  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  title: { fontSize: 16, fontWeight: "900", color: PALETTE.text },
  subText: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  descText: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 10,
  },
  statusText: { fontSize: 12, fontWeight: "900" },

  sectionTitle: { fontSize: 14, fontWeight: "900", color: PALETTE.text },
  mutedText: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  refundNote: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 18,
  },
  refundSubCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: PALETTE.navyTint,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  refundSubTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.text,
  },
  refundSubText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 17,
  },
  refundTimeline: {
    marginTop: 14,
  },
  refundEvidenceRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  refundEvidenceImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: PALETTE.border,
  },
  refundTimelineItem: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: PALETTE.navyTint,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  refundTimelineTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.text,
  },
  refundTimelineTime: {
    fontSize: 11.5,
    fontWeight: "700",
    color: PALETTE.muted,
    textAlign: "right",
  },
  refundTimelineMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 17,
  },

  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    backgroundColor: PALETTE.navyTint,
    borderRadius: 12,
    padding: 14,
  },
  qrImage: { width: 180, height: 180, borderRadius: 12 },

  rowBetween: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  metaLabel: { fontSize: 12.5, fontWeight: "700", color: PALETTE.muted },
  metaValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.text,
    textAlign: "right",
  },

  metaValuePrice: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "900",
    color: "green",
    textAlign: "right",
  },

  actionSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
  },

  actionRow: { marginTop: 12, flexDirection: "row", gap: 10 },

  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnGhost: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  actionBtnPrimary: { backgroundColor: PALETTE.navy },

  actionText: { fontSize: 13, fontWeight: "900" },
  actionTextGhost: { color: PALETTE.text },
  actionTextPrimary: { color: PALETTE.white },

  cancelBtn: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    flexDirection: "row",
    gap: 6,
  },
  cancelBtnText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "900",
  },
  backBtn: {
    backgroundColor: PALETTE.navyTint,
    borderWidth: 1,
    borderColor: PALETTE.border,
    flexDirection: "row",
    gap: 6,
  },
  backBtnText: {
    color: PALETTE.navy,
    fontSize: 13,
    fontWeight: "900",
  },

  divider: { height: 1, backgroundColor: PALETTE.border, marginVertical: 10 },
  totalLabel: { fontSize: 13.5, fontWeight: "900", color: PALETTE.text },
  totalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },

  addressName: {
    marginTop: 8,
    fontSize: 13.5,
    fontWeight: "900",
    color: PALETTE.text,
  },
  addressMeta: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },
});
