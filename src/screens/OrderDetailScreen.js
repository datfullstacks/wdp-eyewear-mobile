// screens/OrderDetailScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

const STATUS_META = {
  pending: {
    label: "Chờ xác nhận",
    color: "#B45309",
    bg: "#FFF7ED",
    icon: "time-outline",
  },
  confirmed: {
    label: "Đã xác nhận",
    color: "#1D4ED8",
    bg: "#EFF6FF",
    icon: "checkmark-circle-outline",
  },
  processing: {
    label: "Đang xử lý",
    color: "#1D4ED8",
    bg: "#EFF6FF",
    icon: "sync-outline",
  },
  shipped: {
    label: "Đang giao",
    color: "#0F766E",
    bg: "#ECFEFF",
    icon: "bicycle-outline",
  },
  delivered: {
    label: "Đã giao",
    color: "#15803D",
    bg: "#ECFDF5",
    icon: "checkmark-done-outline",
  },
  cancelled: {
    label: "Đã hủy",
    color: "#991B1B",
    bg: "#FEE2E2",
    icon: "close-circle-outline",
  },
  returned: {
    label: "Đã trả",
    color: "#6B7280",
    bg: "#F3F4F6",
    icon: "return-down-back-outline",
  },
};

const ORDER_STEPS = [
  { key: "CONFIRMED", label: "Xác nhận", desc: "Đơn hàng đang được xác nhận" },
  { key: "AWAITING_STOCK", label: "Chờ hàng về", desc: "Đang chờ sản phẩm về kho" },
  { key: "PACKING", label: "Đóng gói", desc: "Đơn hàng đang được đóng gói" },
  { key: "SHIPPING", label: "Giao hàng", desc: "Đơn hàng đang được giao" },
  { key: "DELIVERED", label: "Hoàn tất", desc: "Đơn hàng đã được giao" },
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
  return normalized === "estimated" ? "Tạm tính" : "Đã chốt";
}

function getRefundOwnerLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "sales") return "Sale";
  if (normalized === "manager") return "Manager";
  if (normalized === "operations") return "Bộ phận nhận hàng hoàn";
  if (normalized === "customer") return "Bạn";
  return "Đã đóng case";
}

function getRefundNextStepLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "customer_submit_info") return "Bạn bổ sung thông tin";
  if (normalized === "manager_approve") return "Đang chờ phê duyệt thêm";
  if (normalized === "confirm_return_received") return "Đang chờ xác nhận hàng hoàn";
  if (normalized === "start_processing") return "Sale đang chuẩn bị chuyển khoản";
  if (normalized === "complete") return "Sale xác nhận đã chuyển tiền";
  if (normalized === "start_review") return "Sale đang xem xét hồ sơ";
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

function normalizeOrderProgressStatus(status, opsStage) {
  const normalizedOps = String(opsStage || "").trim().toLowerCase();
  const normalized = String(status || "").trim().toLowerCase();

  if (normalizedOps === "awaiting_stock") return "AWAITING_STOCK";
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
          <Ionicons name={icon} size={18} color="#111827" />
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

function ProductRow({ item }) {
  const qty = item?.qty ?? item?.quantity ?? 1;
  const price = item?.price ?? item?.unitPrice ?? 0;
  const lineTotal = item?.lineTotal ?? price * qty;
  const showLensSpecs = isLensItem(item);
  const showManualRx = hasManualRx(item);
  const hasRxPhoto = Boolean(item?.rxPhoto?.uri);

  return (
    <View style={styles.productRow}>
      {item?.image ? (
        <Image source={{ uri: item.image }} style={styles.productImage} />
      ) : (
        <View style={styles.productFallback}>
          <Ionicons name="cube-outline" size={22} color="#6B7280" />
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

        {!!item?.prescriptionSummary?.shortLabel && (
          <Text style={styles.productVariant}>{item.prescriptionSummary.shortLabel}</Text>
        )}

        {Array.isArray(item?.prescriptionSummary?.lines) && item.prescriptionSummary.lines.length ? (
          <View style={{ marginTop: 6, gap: 4 }}>
            {item.prescriptionSummary.lines.map((line) => (
              <Text key={`${item?.itemId || item?.name}-${line}`} style={styles.productVariant}>
                {line}
              </Text>
            ))}
          </View>
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

function normalizeOrderStore(store) {
  if (!store || typeof store !== "object") return null;

  const id = String(store?._id || store?.id || "").trim();
  if (!id) return null;

  return {
    id,
    name: String(store?.name || "").trim(),
    code: String(store?.code || "").trim(),
    city: String(store?.city || "").trim(),
    district: String(store?.district || "").trim(),
    openingHours: String(store?.openingHours || "").trim(),
    supportsTryOn: Boolean(store?.supportsTryOn),
    supportsPickup: store?.supportsPickup !== false,
  };
}

function buildOrderSupportSubject(order, item = null) {
  if (item?.name) {
    return `Bao hanh ${item.name}`;
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

  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!orderId) {
      setError("Thiếu mã đơn hàng.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!silent) setLoading(true);
    setError("");

    try {
      const data = await getOrderByIdApi(orderId, true);
      setOrder(data || null);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Không tải được chi tiết đơn hàng";
      setError(message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useFocusEffect(
    useCallback(() => {
      if (order) {
        loadOrder({ silent: true });
      }
    }, [loadOrder, order])
  );

  const statusKey = String(order?.status || "").toLowerCase();
  const paymentKey = String(order?.paymentStatus || order?.payment?.status || "").toLowerCase();
  const isPaid = ["paid", "success", "succeeded"].includes(paymentKey);
  const hasPaidAmount = isPaid || Number(order?.paidAmount || 0) > 0;
  const paidAmount = Math.max(0, Number(order?.paidAmount || 0));
  const canCancel =
    ["pending", "confirmed", "processing"].includes(statusKey) && !hasPaidAmount;
  const refundStatus = String(order?.refund?.status || "").trim().toLowerCase();
  const hasClosedRefund = ["completed", "rejected"].includes(refundStatus);
  const hasActiveRefund = Boolean(order?.refund && !hasClosedRefund);
  const canCancelWithRefund =
    Boolean(order?._id || order?.id || orderId) &&
    !hasActiveRefund &&
    statusKey === "pending" &&
    paidAmount > 0;
  const canRequestRefund =
    Boolean(order?._id || order?.id || orderId) &&
    !hasActiveRefund &&
    ["confirmed", "processing", "cancelled", "delivered", "returned"].includes(statusKey) &&
    paidAmount > 0;
  const canSubmitRefundInfo = refundStatus === "waiting_customer_info";

  const canPayNow =
    !isPaid &&
    !["cancelled", "canceled", "delivered", "returned"].includes(statusKey);

  const normalizedProgressStatus = normalizeOrderProgressStatus(
    order?.status,
    order?.opsStage
  );

  const activeStepIndex = Math.max(
    0,
    ORDER_STEPS.findIndex((s) => s.key === normalizedProgressStatus)
  );

  const orderItems = useMemo(() => {
    return Array.isArray(order?.items) ? order.items : [];
  }, [order]);

  const totalItems = useMemo(() => {
    return orderItems.reduce(
      (sum, item) => sum + Number(item?.qty || item?.quantity || 1),
      0
    );
  }, [orderItems]);

  const orderStore = useMemo(() => normalizeOrderStore(order?.storeId), [order]);
  const canRequestWarranty = statusKey === "delivered";
  const warrantyItems = useMemo(() => {
    if (!canRequestWarranty) return [];
    return orderItems.filter(Boolean);
  }, [canRequestWarranty, orderItems]);

  const handleCancelOrder = useCallback(() => {
    if (!order?._id || isCancelling) return;
    if (canCancelWithRefund) {
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
  }, [canCancelWithRefund, isCancelling, loadOrder, navigation, order, orderId]);

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
        Alert.alert("Bảo hành", "Không xác định được sản phẩm để tạo case bảo hành.");
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

  if (loading) {
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
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Đang tải chi tiết đơn hàng...</Text>
        </View>
      </SafeAreaView>
    );
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
          <Ionicons name="alert-circle-outline" size={42} color="#9CA3AF" />
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
              <Ionicons name="card-outline" size={16} color="#FFFFFF" />
              <Text style={styles.payNowBtnText}>Thanh toán ngay</Text>
            </TouchableOpacity>
          )}

          {(canCancel || canCancelWithRefund) && (
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
                    {canCancelWithRefund ? "Hủy đơn và hoàn tiền" : "Hủy đơn hàng"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <SectionCard title="Tiến trình đơn hàng" icon="git-branch-outline">
          <View style={styles.timeline}>
            {ORDER_STEPS.map((step, idx) => {
              const active = idx <= activeStepIndex;
              const isLast = idx === ORDER_STEPS.length - 1;

              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={[styles.stepDot, active && styles.stepDotActive]} />
                    {!isLast ? (
                      <View
                        style={[styles.stepLine, active && styles.stepLineActive]}
                      />
                    ) : null}
                  </View>

                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>
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
              <ProductRow key={String(item?.itemId || item?._id || index)} item={item} />
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
                <Text style={styles.refundInfoTitle}>Return / QC</Text>
                <Text style={styles.refundInfoText}>
                  QC: {getRefundInspectionLabel(order?.refund?.inspectionStatus)}
                </Text>
                {order?.refund?.inspectionNote ? (
                  <Text style={styles.refundInfoText}>
                    Ghi chú QC: {order.refund.inspectionNote}
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
                      onPress={() => Linking.openURL(url).catch(() => {})}
                    >
                      <Image source={{ uri: url }} style={styles.refundEvidenceImage} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {getRefundHistoryEntries(order?.refund).length > 0 ? (
              <View style={styles.refundTimelineWrap}>
                <Text style={styles.refundInfoTitle}>Tiến trình refund</Text>
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
                ? "Refund này đang chờ bạn bổ sung thông tin để sale tiếp tục xem xét."
                : "Nếu đơn hàng có vấn đề, bạn có thể gửi yêu cầu refund để sale tiếp nhận và xử lý."}
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
              <Text style={styles.linkText}>Tất cả case</Text>
            </TouchableOpacity>
          }
        >
          <Text style={styles.refundHelperText}>
            Theo dõi support, refund, và warranty của đơn này từ cùng một nơi.
          </Text>

          {!!orderStore && (
            <View style={styles.afterSalesStoreBox}>
              <Text style={styles.afterSalesStoreTitle}>
                Cửa hàng xử lý:{" "}
                {orderStore.name
                  ? `${orderStore.name}${orderStore.code ? ` (${orderStore.code})` : ""}`
                  : "--"}
              </Text>
              <Text style={styles.afterSalesStoreMeta}>
                {[orderStore.district, orderStore.city].filter(Boolean).join(", ") || "--"}
              </Text>
              {orderStore.openingHours ? (
                <Text style={styles.afterSalesStoreMeta}>
                  Giờ mở cửa: {orderStore.openingHours}
                </Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={openOrderSupport}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryActionText}>Tạo ticket cho đơn hàng</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7FB",
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
    color: "#6B7280",
  },

  errorBigText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },

  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
  },

  retryBtnText: {
    color: "#2563EB",
    fontWeight: "800",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F7",
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
    color: "#111827",
  },

  orderDate: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  heroMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  heroMetaBox: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
  },

  heroMetaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },

  heroMetaValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },

  payNowBtn: {
    marginTop: 14,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },

  payNowBtnText: {
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F7",
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
    color: "#111827",
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },

  infoLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },

  infoValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#111827",
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
    color: "#6B7280",
  },

  productsWrap: {
    gap: 10,
  },

  productRow: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },

  productImage: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },

  productFallback: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  productMid: {
    flex: 1,
  },

  productName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 18,
  },

  productTypeBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },

  productTypeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
  },

  productVariant: {
    marginTop: 4,
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6B7280",
  },

  lensSpecsWrap: {
    marginTop: 6,
    gap: 4,
  },

  lensSpecText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#4B5563",
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
    color: "#374151",
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
    color: "#2563EB",
  },

  linkText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
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
    backgroundColor: "#E5E7EB",
    marginTop: 2,
  },

  stepDotActive: {
    backgroundColor: "#2563EB",
  },

  stepLine: {
    width: 2,
    height: 40,
    backgroundColor: "#E5E7EB",
    marginTop: 2,
  },

  stepLineActive: {
    backgroundColor: "#2563EB",
  },

  stepContent: {
    flex: 1,
    paddingBottom: 18,
  },

  stepTitle: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#6B7280",
  },

  stepTitleActive: {
    color: "#111827",
  },

  stepDesc: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },

  refundHelperText: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#4B5563",
    lineHeight: 18,
  },

  refundActionBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  refundActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryActionBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryActionText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
  },

  afterSalesStoreBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  afterSalesStoreTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#111827",
  },

  afterSalesStoreMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    lineHeight: 17,
  },

  afterSalesList: {
    marginTop: 12,
    gap: 10,
  },

  afterSalesCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 12,
    gap: 10,
  },

  afterSalesHeader: {
    gap: 4,
  },

  afterSalesTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },

  afterSalesMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },

  afterSalesActionBtn: {
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  afterSalesActionText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "900",
  },

  afterSalesNoteBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 12,
  },

  afterSalesNoteText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    lineHeight: 17,
  },

  refundInfoBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 12,
  },

  refundInfoTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#111827",
  },

  refundInfoText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
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
    backgroundColor: "#E2E8F0",
  },

  refundTimelineItem: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
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
    color: "#111827",
  },

  refundTimelineTime: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "right",
  },

  refundTimelineNote: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    lineHeight: 17,
  },
});
