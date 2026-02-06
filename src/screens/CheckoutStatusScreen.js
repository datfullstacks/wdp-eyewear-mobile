import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/apiClient";

const PAYMENT_STATUS_META = {
  PENDING_QR: {
    label: "Chờ thanh toán",
    desc: "Vui lòng quét QR SePay để đặt cọc.",
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

const PAYMENT_STATUS_KEYS = Object.keys(PAYMENT_STATUS_META);

const ORDER_STEPS = [
  { key: "CONFIRMED", label: "Xác nhận", desc: "Đơn hàng đang được xác nhận" },
  { key: "AWAITING_STOCK", label: "Chờ hàng về", desc: "Đang chờ sản phẩm về kho" },
  { key: "PACKING", label: "Đóng gói", desc: "Đơn hàng đang được đóng gói" },
  { key: "SHIPPING", label: "Giao hàng", desc: "Đơn hàng đang được giao" },
  { key: "DELIVERED", label: "Hoàn tất", desc: "Đơn hàng đã được giao" },
];

const formatVND = (value) => new Intl.NumberFormat("vi-VN").format(value || 0) + "đ";

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
  const method = String(value || "").trim().toUpperCase();
  if (method) return method;
  return payNow > 0 ? "SEPAY" : "COD";
};

const normalizePaymentStatus = (status, { payNow = 0, method = "SEPAY" } = {}) => {
  if (typeof status === "string" && PAYMENT_STATUS_META[status]) return status;

  const normalized = String(status || "").trim().toLowerCase();
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
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pending" || normalized === "confirmed") return "CONFIRMED";
  if (normalized === "processing") return "PACKING";
  if (normalized === "shipped") return "SHIPPING";
  if (normalized === "delivered") return "DELIVERED";
  return String(status || "CONFIRMED").toUpperCase();
};

const mergeOrderSnapshot = (localOrder = {}, serverOrder = {}) => {
  const localBreakdown = localOrder.breakdown || {};
  const localPayment = localOrder.payment || {};
  const serverPayment = serverOrder.payment || {};
  const nextPaymentStatus = serverPayment.status || serverOrder.paymentStatus || localPayment.status;
  const inferredPaidAt =
    String(nextPaymentStatus || "").toLowerCase() === "paid"
      ? serverOrder.updatedAt || serverOrder.createdAt || localPayment.paidAt || null
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
    breakdown: {
      subtotal: serverOrder.subtotal ?? localBreakdown.subtotal,
      shippingFee: serverOrder.shippingFee ?? localBreakdown.shippingFee,
      discountAmount: serverOrder.discountAmount ?? localBreakdown.discountAmount,
      total: serverOrder.total ?? localBreakdown.total,
      payNow: serverOrder.payNowTotal ?? serverOrder.payNow ?? localBreakdown.payNow,
      payLater: serverOrder.payLaterTotal ?? serverOrder.payLater ?? localBreakdown.payLater,
    },
    payment: {
      ...localPayment,
      ...serverPayment,
      method: serverPayment.method || serverOrder.paymentMethod || localPayment.method,
      status: nextPaymentStatus,
      amount: serverPayment.amount ?? serverOrder.payNowTotal ?? localPayment.amount,
      paymentCode:
        serverPayment.paymentCode ||
        serverPayment.code ||
        serverOrder.paymentCode ||
        localPayment.paymentCode,
      content: serverPayment.content || serverOrder.paymentCode || localPayment.content,
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
  items: [
    { name: "Gọng kính WDP", qty: 1, price: 1250000, preorder: true },
    { name: "Tròng kính chống ánh xanh", qty: 1, price: 1200000, preorder: true },
  ],
  payment: {
    method: "SEPAY",
    status: "PENDING_QR",
    amount: 735000,
    paymentCode: "SEPAY-2025-123456",
    content: "SEPAY-2025-123456",
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

  const payment = raw?.payment || {};
  const paymentMethod = normalizePaymentMethod(payment.method || raw?.paymentMethod, payNow);
  const paymentStatus = normalizePaymentStatus(payment.status || raw?.paymentStatus, {
    payNow,
    method: paymentMethod,
  });
  const paymentCode = firstTextValue(
    payment.paymentCode,
    payment.transactionId,
    payment.code,
    payment.payment_code,
    payment.transaction_code
  );
  const paymentContent =
    firstTextValue(payment.content, payment.payload, payment.paymentContent, payment.text) || paymentCode;
  const paymentAmount = payment.amount ?? payNow;
  const paymentCreatedAt = payment.createdAt || raw?.createdAt || null;
  const paymentPaidAt = payment.paidAt || raw?.paidAt || null;
  const qrCandidate = firstTextValue(
    payment.qrUrl,
    payment.qr_url,
    payment.qrImage,
    payment.qr_image,
    payment.qr,
    payment.qrCode,
    payment.qr_code,
    payment.qrLink,
    payment.qr_link
  );

  const sepayDescription =
    firstTextValue(
      payment.description,
      payment.note,
      payment.memo,
      payment.paymentNote,
      payment.payment_note,
      payment.content,
      payment.payment_content
    ) || paymentContent || paymentCode;
  const sepayAccountNumber = firstTextValue(
    payment.bankAccountNumber,
    payment.accountNumber,
    payment.bank_account_number,
    payment.acc,
    payment.account,
    payment.bankAccountId,
    payment.bank_account_id
  );
  const sepayBankName = firstTextValue(
    payment.bankName,
    payment.bank,
    payment.bank_name,
    payment.bankAccountName,
    payment.bank_account_name,
    payment.bankAccountHolderName,
    payment.bank_account_holder_name
  );
  const sepayQrUrl = buildSepayQrUrl({
    accountNumber: sepayAccountNumber,
    bankName: sepayBankName,
    amount: paymentAmount,
    description: sepayDescription,
  });
  const fallbackQrUrl = payNow > 0 ? makeQrUrl(paymentContent || paymentCode) : null;
  const qrUrl = qrCandidate || sepayQrUrl || fallbackQrUrl;
  const bankAccountIdValue = firstTextValue(payment.bankAccountId, payment.bank_account_id);

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
    address,
    items: raw?.items || [],
    totals: {
      subtotal,
      discountAmount,
      shippingFee,
      total,
      payNow,
      payLater,
    },
    payment: {
      method: paymentMethod,
      status: paymentStatus,
      amount: paymentAmount,
      paymentCode,
      content: paymentContent,
      description: sepayDescription,
      bankAccountId: bankAccountIdValue,
      bankAccountNumber: sepayAccountNumber,
      bankName: sepayBankName,
      createdAt: paymentCreatedAt,
      paidAt: paymentPaidAt,
      qrUrl,
    },
  };
};

export default function CheckoutStatusScreen({ navigation, route }) {
  const initialOrder = route?.params?.order || null;
  const [serverOrder, setServerOrder] = useState(null);

  const rawOrder = useMemo(() => {
    if (initialOrder && serverOrder) return mergeOrderSnapshot(initialOrder, serverOrder);
    return serverOrder || initialOrder || DEMO_ORDER;
  }, [initialOrder, serverOrder]);

  const order = useMemo(() => normalizeOrder(rawOrder), [rawOrder]);
  const pollOrderId = useMemo(() => {
    const id = rawOrder?.orderId || rawOrder?._id || rawOrder?.id;
    if (!id) return null;
    return String(id);
  }, [rawOrder]);

  const [paymentStatus, setPaymentStatus] = useState(order.payment.status);
  const [paidAt, setPaidAt] = useState(order.payment.paidAt || null);

  useEffect(() => {
    if (!pollOrderId || pollOrderId === "OD--" || /^OD\d+$/i.test(pollOrderId)) {
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
          console.log("order polling failed", error?.response?.data || error?.message || error);
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

  useEffect(() => {
    setPaymentStatus(order.payment.status);
    setPaidAt(order.payment.paidAt || null);
  }, [order.payment.status, order.payment.paidAt]);

  const paymentMeta = PAYMENT_STATUS_META[paymentStatus] || PAYMENT_STATUS_META.PENDING_QR;
  const activeStepIndex = Math.max(
    0,
    ORDER_STEPS.findIndex((s) => s.key === order.status)
  );

  const updatePaymentStatus = (nextStatus) => {
    setPaymentStatus(nextStatus);
    if (nextStatus === "PAID") {
      setPaidAt(new Date().toISOString());
    } else {
      setPaidAt(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
            activeOpacity={0.85}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trạng thái đơn hàng</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Đơn hàng {order.orderId}</Text>
          <Text style={styles.subText}>Tạo lúc {formatDateTime(order.createdAt)}</Text>
          <View style={[styles.statusPill, { backgroundColor: paymentMeta.bg }]}> 
            <Text style={[styles.statusText, { color: paymentMeta.color }]}>{paymentMeta.label}</Text>
          </View>
          <Text style={styles.descText}>{paymentMeta.desc}</Text>
        </View>

        {order.payment.qrUrl ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>QR thanh toán SePay</Text>
            <Text style={styles.mutedText}>Quét mã để đặt cọc và hoàn tất đơn đặt trước.</Text>
            <View style={styles.qrWrap}>
              <Image source={{ uri: order.payment.qrUrl }} style={styles.qrImage} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Số tiền cần chuyển</Text>
              <Text style={styles.metaValue}>{formatVND(order.payment.amount)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Mã thanh toán</Text>
              <Text style={styles.metaValue}>{order.payment.paymentCode || "--"}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Nội dung</Text>
              <Text style={styles.metaValue}>
                {order.payment.description || order.payment.content || "--"}
              </Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Tài khoản nhận</Text>
              <Text style={styles.metaValue}>
                {order.payment.bankAccountNumber || order.payment.bankAccountId || "--"}
              </Text>
            </View>
            {order.payment.bankName ? (
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Ngân hàng</Text>
                <Text style={styles.metaValue}>{order.payment.bankName}</Text>
              </View>
            ) : null}
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Thời gian tạo</Text>
              <Text style={styles.metaValue}>{formatDateTime(order.payment.createdAt)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin thanh toán</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Phương thức</Text>
            <Text style={styles.metaValue}>{order.payment.method || "--"}</Text>
          </View>
          {order.totals.payNow > 0 ? (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Đặt cọc</Text>
                <Text style={styles.metaValue}>{formatVND(order.totals.payNow)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Còn lại (COD)</Text>
                <Text style={styles.metaValue}>{formatVND(order.totals.payLater)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Trạng thái</Text>
            <Text style={styles.metaValue}>{paymentMeta.label}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Thời gian giao dịch</Text>
            <Text style={styles.metaValue}>{formatDateTime(paidAt)}</Text>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionHint}>Bypass trạng thái thanh toán</Text>
          <View style={styles.chipRow}>
            {PAYMENT_STATUS_KEYS.map((key) => {
              const active = key === paymentStatus;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => updatePaymentStatus(key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {PAYMENT_STATUS_META[key].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Tạm tính</Text>
            <Text style={styles.metaValue}>{formatVND(order.totals.subtotal)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Giảm giá</Text>
            <Text style={styles.metaValue}>-{formatVND(order.totals.discountAmount)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.metaLabel}>Phí vận chuyển</Text>
            <Text style={styles.metaValue}>{formatVND(order.totals.shippingFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatVND(order.totals.total)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          <Text style={styles.addressName}>{order.address?.fullName || "--"}</Text>
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tiến trình đơn hàng</Text>
          <View style={styles.timeline}>
            {ORDER_STEPS.map((step, idx) => {
              const active = idx <= activeStepIndex;
              const isLast = idx === ORDER_STEPS.length - 1;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={[styles.stepDot, active && styles.stepDotActive]} />
                    {!isLast ? (
                      <View style={[styles.stepLine, active && styles.stepLineActive]} />
                    ) : null}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>{step.label}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
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
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

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
  subText: { marginTop: 6, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  descText: { marginTop: 8, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },

  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 10,
  },
  statusText: { fontSize: 12, fontWeight: "900" },

  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  sectionHint: { marginTop: 12, fontSize: 12.5, fontWeight: "800", color: "#6B7280" },
  mutedText: { marginTop: 6, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },

  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 14,
  },
  qrImage: { width: 180, height: 180, borderRadius: 12 },

  rowBetween: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  metaLabel: { fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  metaValue: { fontSize: 12.5, fontWeight: "900", color: "#111827", flexShrink: 1, textAlign: "right" },

  divider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 10 },
  totalLabel: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  totalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },

  addressName: { marginTop: 8, fontSize: 13.5, fontWeight: "900", color: "#111827" },
  addressMeta: { marginTop: 6, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },

  timeline: { marginTop: 12 },
  stepRow: { flexDirection: "row", alignItems: "flex-start" },
  stepLeft: { width: 20, alignItems: "center" },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
    marginTop: 2,
  },
  stepDotActive: { backgroundColor: "#2563EB" },
  stepLine: {
    width: 2,
    height: 40,
    backgroundColor: "#E5E7EB",
    marginTop: 2,
  },
  stepLineActive: { backgroundColor: "#2563EB" },
  stepContent: { flex: 1, paddingBottom: 18 },
  stepTitle: { fontSize: 13.5, fontWeight: "900", color: "#6B7280" },
  stepTitleActive: { color: "#111827" },
  stepDesc: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  chipActive: { backgroundColor: "#111827" },
  chipText: { fontSize: 11.5, fontWeight: "800", color: "#6B7280" },
  chipTextActive: { color: "#FFFFFF" },
});
