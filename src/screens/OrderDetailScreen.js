// screens/OrderDetailScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { CART_TYPES } from "../store/cartStore";
import { getOrderByIdApi, cancelOrderApi } from "../services/orderService";

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

const STATUS_META = {
  pending: { label: "Chờ xác nhận", color: "#B45309", bg: "#FFF7ED", icon: "time-outline" },
  confirmed: { label: "Đã xác nhận", color: "#1D4ED8", bg: "#EFF6FF", icon: "checkmark-circle-outline" },
  processing: { label: "Đang xử lý", color: "#1D4ED8", bg: "#EFF6FF", icon: "sync-outline" },
  shipped: { label: "Đang giao", color: "#0F766E", bg: "#ECFEFF", icon: "bicycle-outline" },
  delivered: { label: "Đã giao", color: "#15803D", bg: "#ECFDF5", icon: "checkmark-done-outline" },
  cancelled: { label: "Đã hủy", color: "#991B1B", bg: "#FEE2E2", icon: "close-circle-outline" },
  returned: { label: "Đã trả", color: "#6B7280", bg: "#F3F4F6", icon: "return-down-back-outline" },
};

const PREORDER_STEPS = [
  { key: "CONFIRMED", label: "Xác nhận", desc: "Đơn hàng đang được xác nhận" },
  { key: "AWAITING_STOCK", label: "Chờ hàng về", desc: "Đang chờ sản phẩm về kho" },
  { key: "PACKING", label: "Đóng gói", desc: "Đơn hàng đang được đóng gói" },
  { key: "SHIPPING", label: "Giao hàng", desc: "Đơn hàng đang được giao" },
  { key: "DELIVERED", label: "Hoàn tất", desc: "Đơn hàng đã được giao" },
  { key: "CANCELLED", label: "Đã hủy", desc: "Đơn hàng đã bị hủy" },
];

const READY_ORDER_STEPS = [
  { key: "CONFIRMED", label: "Xác nhận", desc: "Đơn hàng đang được xác nhận" },
  { key: "PACKING", label: "Đóng gói", desc: "Sản phẩm có sẵn đang chuẩn bị" },
  { key: "SHIPPING", label: "Giao hàng", desc: "Đơn hàng đang được giao" },
  { key: "DELIVERED", label: "Hoàn tất", desc: "Đơn hàng đã được giao" },
  { key: "CANCELLED", label: "Đã hủy", desc: "Đơn hàng đã bị hủy" },
];

function formatVND(v) {
  return new Intl.NumberFormat("vi-VN").format(Number(v || 0)) + "đ";
}

function formatDateTime(v) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function formatDate(v) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("vi-VN");
}

function normalizeStatusText(value) {
  const raw = String(value || "").trim().toLowerCase();
  const map = {
    confirmed: "Đã xác nhận",
    processing: "Đang xử lý",
    shipped: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
    returned: "Hoàn hàng",
    picking: "Đang lấy hàng",
    waiting_lab: "Chờ vào gia công tròng",
    lens_processing: "Đang cắt mài tròng",
    lens_fitting: "Đang lắp tròng vào gọng",
    qc_check: "Đang QC sau gia công",
    ready_to_pack: "Đã gia công xong, chờ đóng gói",
    packing: "Đang đóng gói",
    ready_to_ship: "Sẵn sàng tạo vận đơn",
    shipment_created: "Đã tạo vận đơn",
    handover_to_carrier: "Đã bàn giao GHN",
    in_transit: "Đang vận chuyển",
    delivery_failed: "Giao thất bại",
    waiting_redelivery: "Chờ giao lại",
    return_pending: "Chờ hoàn hàng",
    return_in_transit: "Đang hoàn hàng",
    waiting_customer_info: "Cần bổ sung thông tin",
    on_hold: "Tạm dừng xử lý",
    exception_hold: "Sự cố giao vận",
    ready_to_pick: "Chờ GHN lấy hàng",
    transporting: "Đang vận chuyển",
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
    none: "Không có",
    created: "Đã tạo",
  };
  return map[raw] || value || "--";
}

function getShippingCollectionTimingLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "with_balance") return "Thu cùng đợt thanh toán còn lại";
  if (normalized === "on_delivery") return "Thu khi giao hàng";
  return "Thu ngay";
}

function getShippingFeeModeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "estimated" ? "Tạm tính" : "Giá thanh toán";
}

function getRefundOwnerLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "sales") return "Nhân viên bán hàng";
  if (normalized === "manager") return "Quản lý";
  if (normalized === "operations") return "Bộ phận nhận hàng hoàn";
  if (normalized === "customer") return "Bạn";
  return "Đã đóng yêu cầu";
}

function getRefundNextStepLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "customer_submit_info") return "Bạn bổ sung thông tin";
  if (normalized === "manager_approve") return "Đang chờ phê duyệt thêm";
  if (normalized === "confirm_return_received") return "Đang chờ xác nhận hàng hoàn";
  if (normalized === "start_processing") return "Nhân viên đang chuẩn bị chuyển khoản";
  if (normalized === "complete") return "Nhân viên xác nhận đã chuyển tiền";
  if (normalized === "start_review") return "Nhân viên đang xem xét hồ sơ";
  return "--";
}

function getRefundInspectionLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pending") return "Đang đối soát";
  if (normalized === "passed") return "Đã đạt";
  if (normalized === "failed") return "Không đạt";
  return "Không yêu cầu";
}

function getRefundHistoryEntries(refund) {
  if (!Array.isArray(refund?.history)) return [];

  return refund.history.map((entry) => ({
    action: String(entry?.action || "").trim().toLowerCase(),
    fromStatus: String(entry?.fromStatus || "none").trim().toLowerCase(),
    toStatus: String(entry?.toStatus || "none").trim().toLowerCase(),
    actorRole: String(entry?.actorRole || "").trim().toLowerCase(),
    actorName: String(entry?.actorName || "").trim(),
    note: String(entry?.note || "").trim(),
    createdAt: entry?.createdAt || null,
  }));
}

function normalizeOrderTypeKey(orderType, items = []) {
  const normalized = String(orderType || "").trim().toLowerCase();

  if (normalized === "preorder" || normalized === "pre_order" || normalized === "đơn đặt trước") {
    return "preorder";
  }

  if (
    normalized === "ready_stock" ||
    normalized === "order" ||
    normalized === "prescription" ||
    normalized === "custom" ||
    normalized === "đơn kính"
  ) {
    return "ready";
  }

  const hasPreorderItem = Array.isArray(items)
    ? items.some((item) => Boolean(item?.preOrder ?? item?.preorder))
    : false;

  return hasPreorderItem ? "preorder" : "ready";
}

function normalizeOrderProgressStatus(status, opsStage, orderTypeKey = "ready") {
  const normalizedOps = String(opsStage || "").trim().toLowerCase();
  const normalized = String(status || "").trim().toLowerCase();

  if (normalizedOps === "awaiting_stock") {
    return orderTypeKey === "preorder" ? "AWAITING_STOCK" : "PACKING";
  }
  if (
    normalizedOps === "waiting_lab" ||
    normalizedOps === "lens_processing" ||
    normalizedOps === "lens_fitting" ||
    normalizedOps === "qc_check" ||
    normalizedOps === "ready_to_pack" ||
    normalizedOps === "packing"
  ) {
    return "PACKING";
  }
  if (normalizedOps === "shipped" || normalizedOps === "shipping") return "SHIPPING";
  if (normalizedOps === "delivered") return "DELIVERED";

  if (normalized === "pending" || normalized === "confirmed") return "CONFIRMED";
  if (normalized === "processing") return "PACKING";
  if (normalized === "shipped") return "SHIPPING";
  if (normalized === "delivered") return "DELIVERED";
  if (normalized === "cancelled" || normalized === "canceled") return "CANCELLED";

  return "CONFIRMED";
}

function StatusBadge({ status }) {
  const meta = STATUS_META[String(status || "pending").toLowerCase()] || STATUS_META.pending;

  return (
    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={15} color={meta.color} />
      <Text style={[styles.statusBadgeText, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}

function SectionCard({ title, icon, children, right }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={18} color={PALETTE.text} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value, valueStyle }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value || "--"}</Text>
    </View>
  );
}

function isLensItem(item) {
  const productType = String(item?.productType || "").toUpperCase();
  const type = String(item?.type || "").toUpperCase();
  return productType === "LENS" || type === "LENS" || type === "CONTACT_LENS";
}

function hasManualRx(item) {
  return Boolean(item?.rxOD?.CYL && item?.rxOD?.AXIS && item?.rxOS?.CYL && item?.rxOS?.AXIS);
}

function ProductRow({ item, onPreviewRxPhoto }) {
  const qty = item?.qty ?? item?.quantity ?? 1;
  const price = item?.price ?? item?.unitPrice ?? 0;
  const lineTotal = item?.lineTotal ?? price * qty;
  const showLensSpecs = isLensItem(item);
  const showManualRx = hasManualRx(item);
  const rxPhotoUrl = String(item?.rxPhoto?.uri || "").trim();
  const hasRxPhoto = Boolean(rxPhotoUrl);

  return (
    <View style={styles.productRow}>
      {item?.image ? (
        <Image source={{ uri: item.image }} style={styles.productImage} />
      ) : (
        <View style={styles.productFallback}>
          <Ionicons name="cube-outline" size={22} color={PALETTE.muted} />
        </View>
      )}

      <View style={styles.productMid}>
        <Text style={styles.productName} numberOfLines={2}>
          {item?.name || "Sản phẩm"}
        </Text>

        {!!item?.displayLabel && (
          <View style={styles.productTypeBadge}>
            <Text style={styles.productTypeBadgeText}>{item.displayLabel}</Text>
          </View>
        )}

        {!!item?.variantText && (
          <Text style={styles.productVariant}>{item.variantText}</Text>
        )}

        {showLensSpecs && !!item?.prescriptionSummary?.shortLabel && (
          <Text style={styles.productVariant}>{item.prescriptionSummary.shortLabel}</Text>
        )}

        {showLensSpecs &&
          Array.isArray(item?.prescriptionSummary?.lines) &&
          item.prescriptionSummary.lines.length ? (
          <View style={{ marginTop: 6, gap: 4 }}>
            {item.prescriptionSummary.lines.map((line) => (
              <Text key={`${item?.itemId || item?.name}-${line}`} style={styles.productVariant}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        {showLensSpecs && hasRxPhoto ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.uploadPreviewCard}
            onPress={() => onPreviewRxPhoto?.(rxPhotoUrl)}
          >
            <Image source={{ uri: rxPhotoUrl }} style={styles.uploadPreviewImage} />
            <View style={styles.uploadPreviewMeta}>
              <Text style={styles.uploadPreviewTitle}>Ảnh đơn kính đã tải</Text>
              <Text style={styles.uploadPreviewHint}>Nhấn để xem ảnh lớn</Text>
            </View>
            <Ionicons name="expand-outline" size={18} color={PALETTE.navy} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.productMetaRow}>
          <Text style={styles.productMeta}>SL: {qty}</Text>
          <Text style={styles.productMeta}>Đơn giá: {formatVND(price)}</Text>
        </View>

        {!!item?.payLater ? (
          <Text style={styles.payLaterText}>
            Thanh toán sau: {formatVND(item.payLater)}
          </Text>
        ) : null}
      </View>

      <View style={styles.productRight}>
        <Text style={styles.productLineTotal}>{formatVND(lineTotal)}</Text>
      </View>
    </View>
  );
}

function buildOrderSupportSubject(order, item = null) {
  if (item?.name) {
    return `Bảo hành ${item.name}`;
  }

  const orderCode = String(order?.paymentCode || order?._id || order?.id || "").trim();
  if (orderCode) {
    return `Hỗ trợ đơn ${orderCode}`;
  }

  return "Hỗ trợ đơn hàng";
}

export default function OrderDetailScreen({ navigation, route }) {
  const orderId = route?.params?.orderId || route?.params?.id || null;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  // 1. Lấy status trước
  const statusKey = String(order?.status || "").toLowerCase();
  const isCancelled = statusKey === "cancelled" || statusKey === "canceled";

  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!orderId) {
      setError("Thiếu mã đơn hàng.");
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await getOrderByIdApi(orderId, true);
      setOrder(data || null);
    } catch (err) {
      setOrder(null);
      setError(err?.message || "Không tải được chi tiết đơn hàng");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useFocusEffect(
    useCallback(() => {
      if (order) loadOrder({ silent: true });
    }, [loadOrder, !!order])
  );

  // Logic tính toán cho UI
  const paymentKey = String(order?.paymentStatus || order?.payment?.status || "").toLowerCase();
  const isPaid = ["paid", "success", "succeeded"].includes(paymentKey);
  const paidAmount = Math.max(0, Number(order?.paidAmount || 0));

  // Các trạng thái cho phép hủy đơn: pending, confirmed
  const canCancel = ["pending", "confirmed", "processing"].includes(statusKey);
  const refundStatus = String(order?.refund?.status || "").trim().toLowerCase();
  const hasClosedRefund = ["completed", "rejected"].includes(refundStatus);
  const hasActiveRefund = Boolean(order?.refund && !hasClosedRefund);
  const canRequestRefund =
    Boolean(order?._id || order?.id || orderId) &&
    !hasActiveRefund &&
    ["pending", "cancelled", "delivered", "returned"].includes(statusKey) &&
    paidAmount > 0;
  const canSubmitRefundInfo = refundStatus === "waiting_customer_info";

  const canPayNow =
    !isPaid &&
    !["cancelled", "canceled", "delivered", "returned"].includes(statusKey);

  const orderItems = useMemo(() => {
    return Array.isArray(order?.items) ? order.items : [];
  }, [order]);

  const orderTypeKey = useMemo(() => {
    return normalizeOrderTypeKey(order?.orderType, orderItems);
  }, [order?.orderType, orderItems]);

  const progressSteps = useMemo(() => {
    const steps = orderTypeKey === "preorder" ? PREORDER_STEPS : READY_ORDER_STEPS;
    // Nếu KHÔNG phải đơn hủy, ẩn bước CANCELLED
    return isCancelled ? steps : steps.filter(s => s.key !== "CANCELLED");
  }, [orderTypeKey, isCancelled]);

  const normalizedProgressStatus = normalizeOrderProgressStatus(
    order?.status,
    order?.opsStage,
    orderTypeKey
  );

  const activeStepIndex = progressSteps.findIndex((s) => s.key === normalizedProgressStatus);

  const totalItems = useMemo(() => {
    return orderItems.reduce(
      (sum, item) => sum + Number(item?.qty || item?.quantity || 1),
      0
    );
  }, [orderItems]);

  const canRequestWarranty = statusKey === "delivered";
  const warrantyItems = useMemo(() => {
    if (!canRequestWarranty) return [];
    return orderItems.filter(Boolean);
  }, [canRequestWarranty, orderItems]);

  const handleCancelOrder = useCallback(() => {
    if (!order?._id || isCancelling) return;
    if (paidAmount > 0) {
      navigation.navigate("CartFlow", {
        screen: "RefundRequest",
        params: {
          orderId: order?._id || order?.id || orderId,
          order,
          refundAction: "cancel_order",
          source: "order_detail",
        },
      });
      return;
    }

    Alert.alert(
      "Hủy đơn hàng?",
      "Bạn chắc chắn muốn hủy đơn này? Thao tác không thể hoàn tác.",
      [
        { text: "Không", style: "cancel" },
        {
          text: "Hủy đơn",
          style: "destructive",
          onPress: async () => {
            try {
              setIsCancelling(true);
              await cancelOrderApi(order._id);
              await loadOrder({ silent: true });
              Alert.alert("Thành công", "Đã hủy đơn hàng.");
            } catch (err) {
              const message =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                "Không thể hủy đơn hàng";
              Alert.alert("Hủy thất bại", message);
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  }, [isCancelling, loadOrder, navigation, order, orderId, paidAmount]);

  const handlePayNow = useCallback(() => {
    if (!order) return;

    const hasPreorderItem = Array.isArray(order?.items)
      ? order.items.some((item) => Boolean(item?.preOrder ?? item?.preorder))
      : false;

    navigation.navigate("CartFlow", {
      screen: "CheckoutStatus",
      params: {
        order,
        cartType: hasPreorderItem ? CART_TYPES.PREORDER : CART_TYPES.ORDER,
      },
    });
  }, [navigation, order]);

  const handleRefundRequest = useCallback(() => {
    if (!order) return;
    if (!canRequestRefund && !canSubmitRefundInfo) return;

    navigation.navigate("CartFlow", {
      screen: "RefundRequest",
      params: {
        orderId: order?._id || order?.id || orderId,
        order,
        refundAction: canSubmitRefundInfo ? "customer_submit_info" : undefined,
        source: "order_detail",
      },
    });
  }, [canRequestRefund, canSubmitRefundInfo, navigation, order, orderId]);

  const openSupportCenter = useCallback(() => {
    navigation.navigate("Support", {
      prefillCategory: "general",
      lockCategory: false,
      orderId: "",
      orderCode: "",
      orderItemId: "",
      orderItemName: "",
      draftSubject: "",
    });
  }, [navigation]);

  const openOrderSupport = useCallback(() => {
    if (!order) return;

    navigation.navigate("Support", {
      prefillCategory: "order",
      lockCategory: false,
      orderId: order?._id || order?.id || orderId,
      orderCode: order?.paymentCode || "",
      orderItemId: "",
      orderItemName: "",
      draftSubject: buildOrderSupportSubject(order),
    });
  }, [navigation, order, orderId]);

  const openWarrantyRequest = useCallback(
    (item) => {
      const itemId = item?.itemId || item?._id || null;
      if (!itemId) {
        Alert.alert("Bảo hành", "Không xác định được sản phẩm để tạo yêu cầu bảo hành.");
        return;
      }

      navigation.navigate("Support", {
        prefillCategory: "warranty",
        lockCategory: true,
        orderId: order?._id || order?.id || orderId,
        orderCode: order?.paymentCode || "",
        orderItemId: itemId,
        orderItemName: item?.name || "",
        draftSubject: buildOrderSupportSubject(order, item),
      });
    },
    [navigation, order, orderId]
  );

  const openTrackingUrl = useCallback(async () => {
    const url = order?.shipment?.trackingUrl;
    if (!url) return;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Thông báo", "Không mở được liên kết theo dõi.");
      }
    } catch {
      Alert.alert("Thông báo", "Không mở được liên kết theo dõi.");
    }
  }, [order]);

  if (loading && !refreshing) {
    return <View style={styles.centerWrap}><ActivityIndicator color={PALETTE.navy} /></View>;
  }

  if (error || !order) {
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
            <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
          </View>
        </View>

        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={42} color={PALETTE.muted} />
          <Text style={styles.errorBigText}>{error || "Không tìm thấy đơn hàng"}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadOrder()}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
        </View>
      </View>

    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadOrder({ silent: true });
          }}
        />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderCode}>{order?.paymentCode || "--"}</Text>
            <Text style={styles.orderDate}>
              Tạo lúc: {formatDateTime(order?.createdAt)}
            </Text>
          </View>
          <StatusBadge status={order?.status} />
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaBox}>
            <Text style={styles.heroMetaLabel}>Thanh toán</Text>
            <Text style={[styles.heroMetaValue, isPaid && { color: "#15803D" }]}>
              {isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
            </Text>
          </View>

          <View style={styles.heroMetaBox}>
            <Text style={styles.heroMetaLabel}>Tổng sản phẩm</Text>
            <Text style={styles.heroMetaValue}>{totalItems}</Text>
          </View>

          <View style={styles.heroMetaBox}>
            <Text style={styles.heroMetaLabel}>Tổng tiền</Text>
            <Text style={[styles.heroMetaValue, { color: "#EF4444" }]}>
              {formatVND(order?.total)}
            </Text>
          </View>
        </View>

        {canPayNow && (
          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={handlePayNow}
            activeOpacity={0.85}
          >
            <Ionicons name="card-outline" size={16} color={PALETTE.white} />
            <Text style={styles.payNowBtnText}>Thanh toán ngay</Text>
          </TouchableOpacity>
        )}

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelOrderBtn}
            onPress={handleCancelOrder}
            activeOpacity={0.85}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#991B1B" />
            ) : (
              <>
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color="#991B1B"
                />
                <Text style={styles.cancelOrderBtnText}>
                  {paidAmount > 0 ? "Hủy đơn và hoàn tiền" : "Hủy đơn hàng"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <SectionCard title="Tiến trình đơn hàng" icon="git-branch-outline">
        <View style={styles.timeline}>
          {progressSteps.map((step, idx) => {
            const isCurrentStep = idx === activeStepIndex;
            const isPassed = idx < activeStepIndex;
            const isLast = idx === progressSteps.length - 1;
            const stepIsCancelledType = step.key === "CANCELLED";

            // Màu sắc chủ đạo: Đỏ nếu là bước hủy đang active, Xanh nếu hoàn tất, Xám nếu chưa tới
            let tintColor = PALETTE.border;
            if (isCancelled && stepIsCancelledType) {
              tintColor = "#EF4444"; // Màu đỏ cho bước hủy
            } else if (!isCancelled && (isCurrentStep || isPassed)) {
              tintColor = "#15803D"; // Màu xanh cho đơn bình thường
            } else if (isCancelled && isPassed) {
              tintColor = "#9CA3AF"; // Màu xám cho các bước trước đó của đơn đã hủy
            } else if (isCurrentStep) {
              tintColor = "#15803D";
            }

            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={[styles.stepDot, { backgroundColor: tintColor }]} />
                  {!isLast && (
                    <View style={[styles.stepLine, { backgroundColor: isPassed ? tintColor : PALETTE.border }]} />
                  )}
                </View>

                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, (isCurrentStep || (isCancelled && stepIsCancelledType)) && { color: tintColor }]}>
                    {step.label}
                  </Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Thông tin đơn hàng" icon="receipt-outline">
        <InfoRow label="Mã đơn" value={order?.paymentCode} />
        <InfoRow label="Loại đơn" value={order?.orderType || "--"} />
        <InfoRow label="Trạng thái đơn" value={normalizeStatusText(order?.status)} />
        <InfoRow label="Tiến độ xử lý" value={normalizeStatusText(order?.opsStage)} />
        <InfoRow
          label="Cập nhật xử lý"
          value={formatDateTime(order?.opsStageUpdatedAt)}
        />
        <InfoRow label="Ngày tạo" value={formatDateTime(order?.createdAt)} />
        <InfoRow label="Ngày cập nhật" value={formatDateTime(order?.updatedAt)} />
        <InfoRow label="Đã thanh toán lúc" value={formatDateTime(order?.paidAt)} />
        <InfoRow
          label="Đã xác nhận lúc"
          value={formatDateTime(order?.confirmedAt)}
        />
      </SectionCard>

      <SectionCard title="Sản phẩm" icon="cube-outline">
        <View style={styles.productCountRow}>
          <Text style={styles.productCountText}>{totalItems} sản phẩm</Text>
        </View>

        <View style={styles.productsWrap}>
          {orderItems.map((item, index) => (
            <ProductRow
              key={String(item?.itemId || item?._id || index)}
              item={item}
              onPreviewRxPhoto={(imageUrl) => setPreviewImageUrl(imageUrl)}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Thanh toán" icon="card-outline">
        <InfoRow
          label="Phương thức"
          value={String(
            Number(order?.payNowTotal || 0) > 0
              ? order?.paymentMethod || order?.payment?.method || "--"
              : order?.payLaterMethod || order?.paymentMethod || order?.payment?.method || "--",
          ).toUpperCase()}
        />
        <InfoRow
          label="Trạng thái"
          value={normalizeStatusText(order?.paymentStatus || order?.payment?.status)}
        />
        <InfoRow label="Tạm tính" value={formatVND(order?.subtotal)} />
        <InfoRow label="Giảm giá" value={formatVND(order?.discountAmount)} />
        <InfoRow
          label={`Phí vận chuyển (${getShippingFeeModeLabel(order?.shippingFeeMode)})`}
          value={formatVND(order?.shippingFee)}
        />
        <InfoRow
          label="Thu phí ship"
          value={getShippingCollectionTimingLabel(order?.shippingCollectionTiming)}
        />
        <InfoRow label="Thanh toán ngay" value={formatVND(order?.payNowTotal)} />
        <InfoRow label="Thanh toán sau" value={formatVND(order?.payLaterTotal)} />
        <InfoRow
          label="Phương thức thu sau"
          value={order?.payLaterMethod ? String(order.payLaterMethod).toUpperCase() : "--"}
        />
        <InfoRow
          label="Tổng thanh toán"
          value={formatVND(order?.total)}
          valueStyle={styles.highlightValue}
        />
      </SectionCard>

      <SectionCard title="Địa chỉ nhận hàng" icon="location-outline">
        <InfoRow label="Người nhận" value={order?.shippingAddress?.fullName} />
        <InfoRow label="Số điện thoại" value={order?.shippingAddress?.phone} />
        <InfoRow label="Email" value={order?.shippingAddress?.email} />
        <InfoRow
          label="Địa chỉ"
          value={[
            order?.shippingAddress?.line1,
            order?.shippingAddress?.line2,
            order?.shippingAddress?.ward,
            order?.shippingAddress?.district,
            order?.shippingAddress?.province,
            order?.shippingAddress?.country,
          ]
            .filter(Boolean)
            .join(", ")}
        />
        <InfoRow label="Ghi chú" value={order?.shippingAddress?.note || "--"} />
      </SectionCard>

      <SectionCard
        title="Vận chuyển"
        icon="bicycle-outline"
        right={
          !!order?.shipment?.trackingUrl ? (
            <TouchableOpacity onPress={openTrackingUrl} activeOpacity={0.8}>
              <Text style={styles.linkText}>Theo dõi</Text>
            </TouchableOpacity>
          ) : null
        }
      >
        <InfoRow
          label="Đơn vị vận chuyển"
          value={String(order?.shipment?.provider || "--").toUpperCase()}
        />
        <InfoRow
          label="Mã vận đơn"
          value={order?.shipment?.trackingCode || order?.opsExecution?.trackingCode || "--"}
        />
        <InfoRow
          label="Trạng thái GHN"
          value={normalizeStatusText(order?.shipment?.latestStatus)}
        />
        <InfoRow label="Mã client" value={order?.shipment?.clientOrderCode || "--"} />
        <InfoRow label="Ngày dự kiến giao" value={formatDate(order?.shipment?.leadtime)} />
        <InfoRow
          label="Lần đồng bộ cuối"
          value={formatDateTime(order?.shipment?.lastSyncedAt)}
        />
      </SectionCard>

      {!!order?.invoiceId && (
        <SectionCard title="Hoá đơn" icon="document-text-outline">
          <InfoRow label="Mã hoá đơn" value={order?.invoiceId?.invoiceCode} />
          <InfoRow label="Tổng tiền" value={formatVND(order?.invoiceId?.total)} />
          <InfoRow
            label="Đã thanh toán"
            value={formatVND(order?.invoiceId?.paidAmount)}
          />
          <InfoRow label="Còn thiếu" value={formatVND(order?.invoiceId?.amountDue)} />
          <InfoRow
            label="Trạng thái"
            value={normalizeStatusText(order?.invoiceId?.status)}
          />
          <InfoRow label="Ngày xuất" value={formatDateTime(order?.invoiceId?.issuedAt)} />
          <InfoRow
            label="Ngày thanh toán"
            value={formatDateTime(order?.invoiceId?.paidAt)}
          />
        </SectionCard>
      )}

      {!!order?.refund && (
        <SectionCard title="Hoàn tiền" icon="return-down-back-outline">
          <InfoRow label="Trạng thái" value={normalizeStatusText(order?.refund?.status)} />
          <InfoRow label="Số tiền" value={formatVND(order?.refund?.amount)} />
          <InfoRow label="Đã thanh toán" value={formatVND(order?.paidAmount)} />
          <InfoRow
            label="Chưa thu"
            value={formatVND(Math.max(0, Number(order?.total || 0) - Number(order?.paidAmount || 0)))}
          />
          <InfoRow label="Lý do" value={order?.refund?.reason || "--"} />
          <InfoRow label="Ghi chú" value={order?.refund?.contactNote || "--"} />
          <InfoRow label="Từ chối" value={order?.refund?.rejectReason || "--"} />
          <InfoRow
            label="Bước tiếp theo"
            value={getRefundNextStepLabel(order?.refund?.nextActionCode)}
          />

          {(order?.refund?.inspectionStatus &&
            order.refund.inspectionStatus !== "not_required") ||
            order?.refund?.returnShipmentCode ||
            order?.refund?.returnCarrier ? (
            <View style={styles.refundInfoBox}>
              <Text style={styles.refundInfoTitle}>hoàn hàng & kiểm tra</Text>
              <Text style={styles.refundInfoText}>
                Kiểm tra: {getRefundInspectionLabel(order?.refund?.inspectionStatus)}
              </Text>
              {order?.refund?.inspectionNote ? (
                <Text style={styles.refundInfoText}>
                  Ghi chú kiểm tra: {order.refund.inspectionNote}
                </Text>
              ) : null}
              {order?.refund?.inspectionAt ? (
                <Text style={styles.refundInfoText}>
                  Kiểm tra lúc: {formatDateTime(order.refund.inspectionAt)}
                </Text>
              ) : null}
              {order?.refund?.returnCarrier ? (
                <Text style={styles.refundInfoText}>
                  Đơn vị hoàn: {String(order.refund.returnCarrier).toUpperCase()}
                </Text>
              ) : null}
              {order?.refund?.returnShipmentCode ? (
                <Text style={styles.refundInfoText}>
                  Mã vận đơn trả: {order.refund.returnShipmentCode}
                </Text>
              ) : null}
              {order?.refund?.returnReceivedAt ? (
                <Text style={styles.refundInfoText}>
                  Đã nhận hàng hoàn: {formatDateTime(order.refund.returnReceivedAt)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {order?.refund?.transactionRef ? (
            <InfoRow label="Mã payout" value={order.refund.transactionRef} />
          ) : null}

          {Array.isArray(order?.refund?.evidence) && order.refund.evidence.length > 0 ? (
            <View style={styles.refundTimelineWrap}>
              <Text style={styles.refundInfoTitle}>Bằng chứng đã gửi</Text>
              <View style={styles.refundEvidenceRow}>
                {order.refund.evidence.slice(0, 4).map((url, index) => (
                  <TouchableOpacity
                    key={`${url}-${index}`}
                    activeOpacity={0.85}
                    onPress={() => Linking.openURL(url).catch(() => { })}
                  >
                    <Image source={{ uri: url }} style={styles.refundEvidenceImage} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {getRefundHistoryEntries(order?.refund).length > 0 ? (
            <View style={styles.refundTimelineWrap}>
              <Text style={styles.refundInfoTitle}>Tiến trình hoàn tiền</Text>
              {getRefundHistoryEntries(order?.refund)
                .slice()
                .reverse()
                .slice(0, 4)
                .map((entry, index) => (
                  <View
                    key={`${entry.createdAt || entry.action || "refund"}-${index}`}
                    style={styles.refundTimelineItem}
                  >
                    <View style={styles.refundTimelineRow}>
                      <Text style={styles.refundTimelineActor}>
                        {entry.actorName ||
                          (entry.actorRole
                            ? getRefundOwnerLabel(entry.actorRole)
                            : "System")}
                      </Text>
                      <Text style={styles.refundTimelineTime}>
                        {formatDateTime(entry.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.refundTimelineNote}>
                      {(entry.fromStatus || "none").toUpperCase()} {"->"}{" "}
                      {(entry.toStatus || "none").toUpperCase()}
                    </Text>
                    {entry.note ? (
                      <Text style={styles.refundTimelineNote}>{entry.note}</Text>
                    ) : null}
                  </View>
                ))}
            </View>
          ) : null}
        </SectionCard>
      )}
      {(canSubmitRefundInfo || canRequestRefund) && (
        <SectionCard title="Yêu cầu hoàn tiền" icon="return-down-back-outline">
          <Text style={styles.refundHelperText}>
            {canSubmitRefundInfo
              ? "Yêu cầu hoàn tiền này đang chờ bạn bổ sung thông tin để nhân viên tiếp tục xem xét."
              : "Nếu đơn hàng có vấn đề, bạn có thể gửi yêu cầu hoàn tiền để nhân viên tiếp nhận và xử lý."}
          </Text>
          <TouchableOpacity
            style={styles.refundActionBtn}
            onPress={handleRefundRequest}
            activeOpacity={0.85}
          >
            <Text style={styles.refundActionText}>
              {canSubmitRefundInfo
                ? "Bổ sung thông tin hoàn tiền"
                : order?.refund
                  ? "Tạo yêu cầu hoàn tiền mới"
                  : "Tạo yêu cầu hoàn tiền"}
            </Text>
          </TouchableOpacity>
        </SectionCard>
      )}

      <SectionCard
        title="Hỗ trợ sau mua"
        icon="chatbubble-ellipses-outline"
        right={
          <TouchableOpacity onPress={openSupportCenter} activeOpacity={0.8}>
            <Text style={styles.linkText}>Tất cả yêu cầu</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.refundHelperText}>
          Theo dõi hỗ trợ, hoàn tiền, và bảo hành của đơn này từ cùng một nơi.
        </Text>

        <TouchableOpacity
          style={styles.secondaryActionBtn}
          onPress={openOrderSupport}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryActionText}>Tạo yêu cầu cho đơn hàng</Text>
        </TouchableOpacity>

        {canRequestWarranty ? (
          <View style={styles.afterSalesList}>
            {warrantyItems.map((item, index) => (
              <View
                key={String(item?.itemId || item?._id || index)}
                style={styles.afterSalesCard}
              >
                <View style={styles.afterSalesHeader}>
                  <Text style={styles.afterSalesTitle}>{item?.name || "Sản phẩm"}</Text>
                  {!!item?.variantText ? (
                    <Text style={styles.afterSalesMeta}>{item.variantText}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.afterSalesActionBtn}
                  onPress={() => openWarrantyRequest(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.afterSalesActionText}>Yêu cầu bảo hành</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.afterSalesNoteBox}>
            <Text style={styles.afterSalesNoteText}>
              Bảo hành sẽ mở khi đơn đã giao thành công.
            </Text>
          </View>
        )}
      </SectionCard>

      <Modal
        visible={Boolean(previewImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl("")}
      >
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImageUrl("")} />
          <View style={styles.previewContentWrap} pointerEvents="box-none">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewImageUrl("")}
              style={styles.previewCloseBtn}
            >
              <Ionicons name="close" size={22} color={PALETTE.text} />
            </TouchableOpacity>
            <View style={styles.previewCard}>
              {previewImageUrl ? (
                <Image source={{ uri: previewImageUrl }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.bg,
  },

  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },

  loadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  errorBigText: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
    textAlign: "center",
  },

  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: PALETTE.navyTint,
  },

  retryBtnText: {
    color: PALETTE.navy,
    fontWeight: "800",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },

  heroCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  orderCode: {
    fontSize: 17,
    fontWeight: "900",
    color: PALETTE.text,
  },

  orderDate: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: PALETTE.muted,
  },

  heroMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  heroMetaBox: {
    flex: 1,
    backgroundColor: PALETTE.navyTint,
    borderRadius: 14,
    padding: 12,
  },

  heroMetaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: PALETTE.muted,
    marginBottom: 6,
  },

  heroMetaValue: {
    fontSize: 13,
    fontWeight: "900",
    color: PALETTE.text,
  },

  payNowBtn: {
    marginTop: 14,
    height: 42,
    borderRadius: 14,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },

  payNowBtnText: {
    color: PALETTE.white,
    fontWeight: "800",
  },

  cancelOrderBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },

  cancelOrderBtnText: {
    color: "#991B1B",
    fontWeight: "800",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  sectionCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: PALETTE.text,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },

  infoLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  infoValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.text,
    textAlign: "right",
  },

  highlightValue: {
    color: "#EF4444",
    fontWeight: "900",
  },

  productCountRow: {
    marginBottom: 10,
  },

  productCountText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  productsWrap: {
    gap: 10,
  },

  productRow: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: PALETTE.navyTint,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  productImage: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: PALETTE.white,
  },

  productFallback: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
  },

  productMid: {
    flex: 1,
  },

  productName: {
    fontSize: 13,
    fontWeight: "800",
    color: PALETTE.text,
    lineHeight: 18,
  },

  productTypeBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: PALETTE.white,
  },

  productTypeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: PALETTE.navy,
  },

  productVariant: {
    marginTop: 4,
    fontSize: 11.5,
    fontWeight: "600",
    color: PALETTE.muted,
  },

  lensSpecsWrap: {
    marginTop: 6,
    gap: 4,
  },

  lensSpecText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 16,
  },

  productMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap",
  },

  productMeta: {
    fontSize: 11.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  uploadPreviewCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  uploadPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: PALETTE.border,
  },
  uploadPreviewMeta: {
    flex: 1,
    gap: 4,
  },
  uploadPreviewTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.text,
  },
  uploadPreviewHint: {
    fontSize: 11.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  payLaterText: {
    marginTop: 5,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#B45309",
  },

  productRight: {
    justifyContent: "center",
  },

  productLineTotal: {
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.navy,
  },

  linkText: {
    fontSize: 12,
    fontWeight: "800",
    color: PALETTE.navy,
  },

  timeline: {
    marginTop: 12,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  stepLeft: {
    width: 20,
    alignItems: "center",
  },

  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.border,
    marginTop: 2,
  },

  stepDotActive: {
    backgroundColor: "green",
  },

  stepLine: {
    width: 2,
    height: 40,
    backgroundColor: PALETTE.border,
    marginTop: 2,
  },

  stepLineActive: {
    backgroundColor: "green",
  },

  stepContent: {
    flex: 1,
    paddingBottom: 18,
  },

  stepTitle: {
    fontSize: 13.5,
    fontWeight: "900",
    color: PALETTE.muted,
  },

  stepTitleActive: {
    color: "green",
  },

  stepDesc: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  refundHelperText: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 18,
  },

  refundActionBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },

  refundActionText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryActionBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 14,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryActionText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "900",
  },

  afterSalesList: {
    marginTop: 12,
    gap: 10,
  },

  afterSalesCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.navyTint,
    padding: 12,
    gap: 10,
  },

  afterSalesHeader: {
    gap: 4,
  },

  afterSalesTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: PALETTE.text,
  },

  afterSalesMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  afterSalesActionBtn: {
    height: 40,
    borderRadius: 12,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },

  afterSalesActionText: {
    color: PALETTE.white,
    fontSize: 12.5,
    fontWeight: "900",
  },

  afterSalesNoteBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.navyTint,
    padding: 12,
  },

  afterSalesNoteText: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 17,
  },

  refundInfoBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.navyTint,
    padding: 12,
  },

  refundInfoTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.text,
  },

  refundInfoText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 17,
  },

  refundTimelineWrap: {
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.navyTint,
    padding: 12,
  },

  refundTimelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  refundTimelineActor: {
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

  refundTimelineNote: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 17,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  previewContentWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 24,
    zIndex: 2,
  },
  previewCard: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewCloseBtn: {
    position: "absolute",
    top: 50,
    right: 18,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
  },
});
