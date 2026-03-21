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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/apiClient";
import { cancelOrderApi } from "../services/orderService";

const PAYMENT_STATUS_META = {
  PENDING_QR: {
    label: "Chờ thanh toán",
    desc: "Vui lòng quét mã QR để đặt cọc.",
    color: "#B45309",
    bg: "#FFF7ED",
  },
  PENDING_COD: {
    label: "Thanh toán khi nhận hàng",
    desc: "Thanh toán phần còn lại khi nhận hàng (COD).",
    color: "#1D4ED8",
    bg: "#EFF6FF",
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
    color: "#6B7280",
    bg: "#F3F4F6",
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    desc: "Giao dịch đã được hoàn tiền.",
    color: "#1D4ED8",
    bg: "#EFF6FF",
  },
};

const REFUND_STATUS_META = {
  requested: {
    label: "Da gui yeu cau",
    desc: "Yeu cau refund da duoc ghi nhan va dang cho staff tiep nhan.",
    color: "#B45309",
    bg: "#FFF7ED",
  },
  reviewing: {
    label: "Dang review",
    desc: "Staff dang kiem tra thong tin refund cua ban.",
    color: "#1D4ED8",
    bg: "#EFF6FF",
  },
  waiting_customer_info: {
    label: "Can bo sung",
    desc: "Vui long bo sung them thong tin/chung tu cho yeu cau refund.",
    color: "#B45309",
    bg: "#FFF7ED",
  },
  escalated_to_manager: {
    label: "Cho manager",
    desc: "Case dang duoc chuyen manager de phe duyet them.",
    color: "#991B1B",
    bg: "#FEE2E2",
  },
  approved: {
    label: "Da duyet",
    desc: "Yeu cau refund da duoc duyet, he thong dang chuyen sang buoc xu ly.",
    color: "#15803D",
    bg: "#ECFDF5",
  },
  return_pending: {
    label: "Cho tra hang",
    desc: "Case can doi soat hang hoan truoc khi payout.",
    color: "#B45309",
    bg: "#FFF7ED",
  },
  return_received: {
    label: "Da nhan hang hoan",
    desc: "Operations da xac nhan hang hoan va se tiep tuc payout.",
    color: "#1D4ED8",
    bg: "#EFF6FF",
  },
  processing: {
    label: "Dang hoan tien",
    desc: "He thong dang xu ly giao dich refund.",
    color: "#1D4ED8",
    bg: "#EFF6FF",
  },
  completed: {
    label: "Hoan tat",
    desc: "Refund da hoan tat.",
    color: "#15803D",
    bg: "#ECFDF5",
  },
  rejected: {
    label: "Tu choi",
    desc: "Yeu cau refund da bi tu choi. Xem ghi chu de biet them chi tiet.",
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

  if (normalized === "paid") return "PAID";
  if (normalized === "failed") return "FAILED";
  if (normalized === "refunded") return "REFUNDED";
  if (normalized === "expired") return "EXPIRED";
  if (normalized === "partial") return "PENDING_QR";
  if (normalized === "pending") {
    return method === "COD" || payNow <= 0 ? "PENDING_COD" : "PENDING_QR";
  }

  return method === "COD" || payNow <= 0 ? "PENDING_COD" : "PENDING_QR";
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
  if (normalized === "sales") return "Sale/Staff";
  if (normalized === "manager") return "Manager";
  if (normalized === "operations") return "Operations";
  if (normalized === "customer") return "Ban";
  return "Da dong case";
};

const getRefundNextStepLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "customer_submit_info") return "Ban bo sung thong tin";
  if (normalized === "manager_approve") return "Manager quyet dinh";
  if (normalized === "confirm_return_received") {
    return "Operations nhan va doi soat hang hoan";
  }
  if (normalized === "start_processing") return "Operations bat dau payout";
  if (normalized === "complete") return "Operations xac nhan da chuyen tien";
  if (normalized === "start_review") return "Staff review ho so";
  return "--";
};

const getRefundInspectionLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pending") return "Dang doi soat";
  if (normalized === "passed") return "Da dat";
  if (normalized === "failed") return "Khong dat";
  return "Khong yeu cau";
};

const getShippingMethodLabel = (value) => {
  const normalized = normalizeShippingMethod(value);
  if (normalized === "express") return "Giao nhanh";
  return "Giao tieu chuan";
};

const getShippingCollectionTimingLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "with_balance") return "Thu cùng đợt thanh toán còn lại";
  if (normalized === "on_delivery") return "Thu khi giao hàng";
  return "Thu ngay";
};

const getShippingFeeModeLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "estimated" ? "Tạm tính" : "Đã chốt";
};

const mergeOrderSnapshot = (localOrder = {}, serverOrder = {}) => {
  const localBreakdown = localOrder.breakdown || {};
  const localPayment = localOrder.payment || {};
  const serverPayment = serverOrder.payment || {};
  const nextPaymentStatus =
    serverPayment.status || serverOrder.paymentStatus || localPayment.status;

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

const DEMO_ORDER = {
  orderId: "OD123456",
  createdAt: new Date().toISOString(),
  status: "CONFIRMED",
  breakdown: {
    subtotal: 2450000,
    shippingFee: 25000,
    discountAmount: 50000,
    total: 2450000,
    payNow: 735000,
    payLater: 1715000,
  },
  shippingAddress: {
    fullName: "Nguyễn Văn A",
    phone: "0912 345 678",
    line1: "123 Đường Lê Lợi",
    ward: "Phường Bến Nghé",
    district: "Quận 1",
    province: "TP. Hồ Chí Minh",
    country: "VN",
  },
  payment: {
    method: "VNPAY",
    status: "PENDING_QR",
    amount: 735000,
    paymentCode: "VNPAY-2025-123456",
    content: "VNPAY-2025-123456",
    bankAccountId: "BANK-001",
    createdAt: new Date().toISOString(),
    paidAt: null,
  },
};

const normalizeOrder = (raw) => {
  const breakdown = raw?.breakdown || {};
  const subtotal = breakdown.subtotal ?? raw?.subtotal ?? raw?.total ?? 0;
  const discountAmount =
    breakdown.discountAmount ?? raw?.discountAmount ?? raw?.discount ?? 0;
  const shippingFee = breakdown.shippingFee ?? raw?.shippingFee ?? 0;
  const total = breakdown.total ?? raw?.total ?? 0;
  const payNow = breakdown.payNow ?? raw?.payNow ?? 0;
  const payLater =
    breakdown.payLater ?? raw?.payLater ?? Math.max(0, total - payNow);
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
    payment.status || raw?.paymentStatus,
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
    return serverOrder || initialOrder || DEMO_ORDER;
  }, [initialOrder, serverOrder]);

  const order = useMemo(() => normalizeOrder(rawOrder), [rawOrder]);

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
    if (
      !pollOrderId ||
      pollOrderId === "OD--" ||
      /^OD\d+$/i.test(pollOrderId)
    ) {
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
          console.log(
            "order polling failed",
            error?.response?.data || error?.message || error
          );
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

  const canCancelOrder =
    ["PENDING", "CONFIRMED", "PROCESSING"].includes(rawOrderStatusKey);
  const refundStatus = String(order.refund?.status || "")
    .trim()
    .toLowerCase();
  const hasClosedRefund =
    order.refund &&
    ["completed", "rejected"].includes(refundStatus);
  const hasActiveRefund = Boolean(order.refund && !hasClosedRefund);
  const rawPaidAmount = Math.max(0, Number(order.paidAmount || 0));
  const refundMeta = order.refund
    ? REFUND_STATUS_META[refundStatus] || REFUND_STATUS_META.requested
    : null;
  const canSubmitRefundInfo =
    Boolean(pollOrderId) && refundStatus === "waiting_customer_info";
  const canRequestRefund =
    Boolean(pollOrderId) &&
    !hasActiveRefund &&
    ["PENDING", "CANCELLED", "DELIVERED", "RETURNED"].includes(
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
    if (paymentStatus === "PAID" && !clearedRef.current) {
      clearedRef.current = true;
      clearCart(cartType);
    }
  }, [paymentStatus, clearCart, cartType]);

  const handleContinueShopping = () => navigateToTab("ProductsTab", "Products");
  const handleViewOrderDetail = () => navigateToTab("ProfileTab", "Orders");
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

    if (!orderId || orderId === "OD--" || /^OD\d+$/i.test(String(orderId))) {
      Alert.alert("Không thể hủy", "Thiếu orderId hợp lệ.");
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
              <Text style={styles.metaValue}>
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

            {canCancelOrder ? (
              <View style={styles.actionSection}>
                <Text style={styles.sectionTitle}>Thao tác</Text>
                <Text style={styles.mutedText}>
                  Nếu bạn không muốn tiếp tục thanh toán, có thể hủy đơn hàng
                  này.
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
                    {isCancelling ? "Đang hủy..." : "Hủy thanh toán"}
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
              Không có ảnh QR hợp lệ từ hệ thống. Vui lòng mở link thanh toán.
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
                Mở link thanh toán
              </Text>
            </TouchableOpacity>

            {canCancelOrder ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn, { marginTop: 10 }]}
                activeOpacity={0.85}
                disabled={isCancelling}
                onPress={handleCancelPayment}
              >
                  <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
                  <Text style={styles.cancelBtnText}>
                    {isCancelling ? "Đang hủy..." : "Hủy thanh toán"}
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
            <Text style={styles.metaLabel}>Phí ship</Text>
            <Text style={styles.metaValue}>
              {getShippingFeeModeLabel(order.totals.shippingFeeMode)}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Thu phí ship</Text>
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

        {isPaymentSettled ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thanh toán thành công!</Text>
            <Text style={styles.mutedText}>
              Đơn hàng đã được ghi nhận. Bạn có thể mua tiếp hoặc xem chi tiết
              đơn.
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnGhost]}
                activeOpacity={0.85}
                onPress={handleContinueShopping}
              >
                <Text style={[styles.actionText, styles.actionTextGhost]}>
                  Mua tiếp
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

        {order.refund ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Trang thai hoan tien</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: refundMeta?.bg || "#EFF6FF" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: refundMeta?.color || "#1D4ED8" },
                ]}
              >
                {refundMeta?.label || "Dang xu ly"}
              </Text>
            </View>
            <Text style={styles.mutedText}>
              {refundMeta?.desc || "Yeu cau refund dang duoc xu ly."}
            </Text>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Tien de nghi hoan</Text>
              <Text style={styles.metaValue}>
                {formatVND(
                  order.refund.requestedBreakdown.total || order.refund.amount,
                )}
              </Text>
            </View>

            {order.refund.approvedBreakdown.total > 0 ? (
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Tien da duyet</Text>
                <Text style={styles.metaValue}>
                  {formatVND(order.refund.approvedBreakdown.total)}
                </Text>
              </View>
            ) : null}

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Ngay yeu cau</Text>
              <Text style={styles.metaValue}>
                {formatDateTime(order.refund.requestedAt)}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Da thanh toan</Text>
              <Text style={styles.metaValue}>{formatVND(order.paidAmount)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Chua thu</Text>
              <Text style={styles.metaValue}>{formatVND(order.unpaidAmount)}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Owner hien tai</Text>
              <Text style={styles.metaValue}>
                {getRefundOwnerLabel(order.refund.currentOwnerRole)}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Buoc tiep theo</Text>
              <Text style={styles.metaValue}>
                {getRefundNextStepLabel(order.refund.nextActionCode)}
              </Text>
            </View>

            {order.refund.processedAt ? (
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Ngay xu ly</Text>
                <Text style={styles.metaValue}>
                  {formatDateTime(order.refund.processedAt)}
                </Text>
              </View>
            ) : null}

            {order.refund.reason ? (
              <Text style={styles.refundNote}>Ly do: {order.refund.reason}</Text>
            ) : null}

            {order.refund.rejectReason ? (
              <Text style={styles.refundNote}>
                Ly do tu choi: {order.refund.rejectReason}
              </Text>
            ) : null}

            {order.refund.decisionNote ? (
              <Text style={styles.refundNote}>
                Ghi chu: {order.refund.decisionNote}
              </Text>
            ) : null}

            {order.refund.contactNote ? (
              <Text style={styles.refundNote}>
                Staff yeu cau: {order.refund.contactNote}
              </Text>
            ) : null}

            {order.refund.requiresReturn ||
            order.refund.returnShipmentCode ||
            order.refund.inspectionStatus !== "not_required" ? (
              <View style={styles.refundSubCard}>
                <Text style={styles.refundSubTitle}>Thong tin return / QC</Text>
                <Text style={styles.refundSubText}>
                  QC: {getRefundInspectionLabel(order.refund.inspectionStatus)}
                </Text>
                {order.refund.inspectionNote ? (
                  <Text style={styles.refundSubText}>
                    Ghi chu QC: {order.refund.inspectionNote}
                  </Text>
                ) : null}
                {order.refund.inspectionAt ? (
                  <Text style={styles.refundSubText}>
                    Kiem tra luc: {formatDateTime(order.refund.inspectionAt)}
                  </Text>
                ) : null}
                {order.refund.returnCarrier ? (
                  <Text style={styles.refundSubText}>
                    Don vi hoan: {String(order.refund.returnCarrier).toUpperCase()}
                  </Text>
                ) : null}
                {order.refund.returnShipmentCode ? (
                  <Text style={styles.refundSubText}>
                    Ma van don tra: {order.refund.returnShipmentCode}
                  </Text>
                ) : null}
                {order.refund.returnReceivedAt ? (
                  <Text style={styles.refundSubText}>
                    Da nhan hang hoan: {formatDateTime(order.refund.returnReceivedAt)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {order.refund.bankAccount?.accountNumber ? (
              <Text style={styles.refundNote}>
                Tai khoan nhan tien: {order.refund.bankAccount.bankName || "--"} -{" "}
                {order.refund.bankAccount.accountNumber}
              </Text>
            ) : null}

            {order.totals.payLater > 0 ? (
              <Text style={styles.refundNote}>
                Refund hien tai chi ap dung tren tien coc/tien da thanh toan.
              </Text>
            ) : null}

            {order.refund.transactionRef ? (
              <Text style={styles.refundNote}>
                Ma giao dich refund: {order.refund.transactionRef}
              </Text>
            ) : null}

            {order.refund.evidence?.length ? (
              <View style={styles.refundTimeline}>
                <Text style={styles.refundSubTitle}>Bang chung da gui</Text>
                <View style={styles.refundEvidenceRow}>
                  {order.refund.evidence.slice(0, 4).map((url, index) => (
                    <TouchableOpacity
                      key={`${url}-${index}`}
                      activeOpacity={0.85}
                      onPress={() => Linking.openURL(url).catch(() => {})}
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
                <Text style={styles.refundSubTitle}>Tien trinh refund</Text>
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
                  Bo sung thong tin hoan tien
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
                  Tao yeu cau hoan tien moi
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : canRequestRefund ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Yeu cau hoan tien</Text>
            <Text style={styles.mutedText}>
              Neu don hang co van de, ban co the gui yeu cau refund de staff tiep
              nhan va xu ly.
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
                Tao yeu cau hoan tien
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Phuong thuc giao hang</Text>
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
            <Text style={styles.metaLabel}>Thu phí ship</Text>
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
  safe: { flex: 1, backgroundColor: "#F6F7FB" },

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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  title: { fontSize: 16, fontWeight: "900", color: "#111827" },
  subText: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  descText: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },

  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 10,
  },
  statusText: { fontSize: 12, fontWeight: "900" },

  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  mutedText: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  refundNote: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#4B5563",
    lineHeight: 18,
  },
  refundSubCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  refundSubTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#111827",
  },
  refundSubText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
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
    backgroundColor: "#E2E8F0",
  },
  refundTimelineItem: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  refundTimelineTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "900",
    color: "#111827",
  },
  refundTimelineTime: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "right",
  },
  refundTimelineMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    lineHeight: 17,
  },

  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    backgroundColor: "#F3F4F6",
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
  metaLabel: { fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  metaValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "900",
    color: "#111827",
    textAlign: "right",
  },

  actionSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionBtnPrimary: { backgroundColor: "#2563EB" },

  actionText: { fontSize: 13, fontWeight: "900" },
  actionTextGhost: { color: "#111827" },
  actionTextPrimary: { color: "#FFFFFF" },

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

  divider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 10 },
  totalLabel: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  totalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },

  addressName: {
    marginTop: 8,
    fontSize: 13.5,
    fontWeight: "900",
    color: "#111827",
  },
  addressMeta: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
});
