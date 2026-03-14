// components/OrderCard.js
import React, { useMemo, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

const TYPE_META = {
  lens: { icon: "eye-outline", color: "#2563EB", bg: "#EFF6FF", label: "Tròng kính" },
  contact_lens: { icon: "eye-outline", color: "#2563EB", bg: "#EFF6FF", label: "Kính áp tròng" },
  frame: { icon: "glasses-outline", color: "#6B7280", bg: "#F3F4F6", label: "Gọng kính" },
  sunglasses: { icon: "glasses-outline", color: "#B45309", bg: "#FFF7ED", label: "Kính mát" },
  accessory: { icon: "grid-outline", color: "#6B7280", bg: "#F3F4F6", label: "Phụ kiện" },
  service: { icon: "build-outline", color: "#15803D", bg: "#ECFDF5", label: "Dịch vụ" },
};

const formatVND = (v) => {
  const num = Number(v || 0);
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "tr";
  }
  return new Intl.NumberFormat("vi-VN").format(num) + "đ";
};

const formatDate = (v) => {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);

  const now = new Date();
  const diff = now - d;
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Hôm nay, ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays === 1) {
    return `Hôm qua, ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  }

  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function StatusBadge({ status, size = "medium" }) {
  const key = String(status || "pending").toLowerCase();
  const meta = STATUS_META[key] || STATUS_META.pending;

  const badgeStyles = {
    small: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 10 },
    medium: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 11.5 },
  };

  const selected = badgeStyles[size] || badgeStyles.medium;

  return (
    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
      <Ionicons name={meta.icon} size={selected.fontSize + 2} color={meta.color} />
      <Text style={[styles.statusBadgeText, { color: meta.color, fontSize: selected.fontSize }]}>
        {meta.label}
      </Text>
    </View>
  );
}

function PreorderBadge() {
  return (
    <View style={styles.preorderBadge}>
      <Ionicons name="time-outline" size={13} color="#15803D" />
      <Text style={styles.preorderBadgeText}>Đặt trước</Text>
    </View>
  );
}

function OrderItemRow({ orderItem, onEdit }) {
  const typeKey = String(orderItem?.type || "").toLowerCase();
  const typeMeta = TYPE_META[typeKey] || {
    icon: "cube-outline",
    color: "#6B7280",
    bg: "#F3F4F6",
    label: "Sản phẩm",
  };

  const hasImage = Boolean(orderItem?.image);

  return (
    <View style={styles.orderItemRow}>
      <View style={styles.orderItemLeft}>
        {hasImage ? (
          <Image source={{ uri: orderItem.image }} style={styles.itemThumb} />
        ) : (
          <View style={[styles.itemThumbIcon, { backgroundColor: typeMeta.bg }]}>
            <Ionicons name={typeMeta.icon} size={20} color={typeMeta.color} />
          </View>
        )}

        {orderItem?.preorder && (
          <View style={styles.preorderItemBadge}>
            <Ionicons name="time-outline" size={10} color="#15803D" />
            <Text style={styles.preorderItemBadgeText}>Đặt trước</Text>
          </View>
        )}
      </View>

      <View style={styles.orderItemMid}>
        <Text style={styles.orderItemName} numberOfLines={2}>
          {orderItem?.name || "Sản phẩm"}
        </Text>

        <View style={styles.orderItemMetaRow}>
          <Text style={styles.orderItemQty}>x{orderItem?.qty ?? 1}</Text>
          <Text style={styles.orderItemPrice}>{formatVND(orderItem?.price)}</Text>
        </View>

        {(orderItem?.payLater ?? 0) > 0 && (
          <View style={styles.payLaterBadge}>
            <Ionicons name="card-outline" size={10} color="#B45309" />
            <Text style={styles.payLaterText}>
              Còn {formatVND(orderItem.payLater)}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.editItemBtn}
        activeOpacity={0.7}
        onPress={(e) => {
          e?.stopPropagation?.();
          onEdit?.();
        }}
      >
        <Ionicons name="create-outline" size={14} color="#2563EB" />
        <Text style={styles.editItemBtnText}>Sửa</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OrderCard({
  order,
  onEditItem,
  onCancel,
  onPress,
  showEditButton = true,
}) {
  const orderId = order?._id || order?.id || "--";
  const orderCode = order?.paymentCode;
  const orderItems = Array.isArray(order?.items) ? order.items : [];

  const statusKey = String(order?.status || "").toLowerCase();
  const paymentKey = String(order?.paymentStatus || order?.payment?.status || "").toLowerCase();
  const isPaid = ["paid", "success", "succeeded"].includes(paymentKey);

  const canCancel = ["pending", "confirmed", "processing"].includes(statusKey) && !isPaid;

  const totalItems = orderItems.reduce((sum, item) => sum + (item?.qty || 1), 0);
  const hasPreorder = orderItems.some((item) => item?.preorder);

  const [visibleCount, setVisibleCount] = useState(2);

  const visibleItems = useMemo(() => {
    return orderItems.slice(0, visibleCount);
  }, [orderItems, visibleCount]);

  const remainingCount = Math.max(orderItems.length - visibleCount, 0);
  const canExpand = remainingCount > 0;
  const canCollapse = orderItems.length > 2 && visibleCount >= orderItems.length;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      style={styles.cardWrapper}
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <View style={styles.orderCodeContainer}>
              <Ionicons name="receipt-outline" size={16} color="black" />
              <Text style={styles.orderCode} numberOfLines={1}>
                {orderCode}
              </Text>
            </View>
            <View style={styles.orderDateContainer}>
              <Ionicons name="calendar-outline" size={12} color="black" />
              <Text style={styles.orderDate}>{formatDate(order?.createdAt)}</Text>
            </View>
          </View>

          <View style={styles.badgeContainer}>
            <StatusBadge status={order?.status} />
            {hasPreorder && <PreorderBadge />}
          </View>
        </View>

        <View style={styles.itemsPreview}>
          <View style={styles.itemsCount}>
            <Ionicons name="cube-outline" size={14} color="black" />
            <Text style={styles.itemsCountText}>{totalItems} sản phẩm</Text>
          </View>

          {orderItems.length > 0 && (
            <View style={styles.itemsList}>
              {visibleItems.map((item, idx) => (
                <OrderItemRow
                  key={orderId + "-" + idx}
                  orderItem={item}
                  onEdit={() => showEditButton && onEditItem?.(item, order)}
                />
              ))}

              {canExpand && (
                <TouchableOpacity
                  style={styles.viewMoreBtn}
                  activeOpacity={0.8}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    setVisibleCount((prev) => Math.min(prev + 2, orderItems.length));
                  }}
                >
                  <Text style={styles.viewMoreText}>
                    +{Math.min(2, remainingCount)} sản phẩm khác
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#2563EB" />
                </TouchableOpacity>
              )}

              {canCollapse && (
                <TouchableOpacity
                  style={styles.viewMoreBtn}
                  activeOpacity={0.8}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    setVisibleCount(2);
                  }}
                >
                  <Text style={styles.viewMoreText}>Thu gọn</Text>
                  <Ionicons name="chevron-up" size={14} color="#2563EB" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.paymentStatus}>
            {isPaid ? (
              <View style={styles.paidTag}>
                <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                <Text style={styles.paidTagText}>Đã thanh toán</Text>
              </View>
            ) : (
              <View style={styles.unpaidTag}>
                <Ionicons name="time-outline" size={14} color="#B45309" />
                <Text style={styles.unpaidTagText}>Chưa thanh toán</Text>
              </View>
            )}
          </View>

          <View style={styles.footerRight}>
            {canCancel && (
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.8}
                onPress={(e) => {
                  e.stopPropagation();
                  onCancel?.(order);
                }}
              >
                <Ionicons name="close-outline" size={16} color="#991B1B" />
                <Text style={styles.cancelBtnText}>Huỷ</Text>
              </TouchableOpacity>
            )}

            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Tổng</Text>
              <Text style={styles.totalValue}>{formatVND(order?.total)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 16,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  orderInfo: {
    flex: 1,
    gap: 4,
  },

  orderCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  orderCode: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  orderDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  orderDate: {
    fontSize: 12,
    fontWeight: "500",
    color: "black",
  },

  badgeContainer: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
    justifyContent: "flex-start",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  preorderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
  },

  preorderBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#15803D",
  },

  itemsPreview: {
    marginBottom: 12,
  },

  itemsCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  itemsCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: "black",
  },

  itemsList: {
    gap: 8,
  },

  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },

  orderItemLeft: {
    position: "relative",
  },

  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },

  itemThumbIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  preorderItemBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  preorderItemBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#15803D",
  },

  orderItemMid: {
    flex: 1,
  },

  orderItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 18,
    marginBottom: 4,
  },

  orderItemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  orderItemQty: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  orderItemPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  payLaterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    alignSelf: "flex-start",
  },

  payLaterText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },

  editItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },

  editItemBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },

  viewMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    marginTop: 4,
  },

  viewMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },

  paymentStatus: {
    flex: 1,
  },

  paidTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  paidTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },

  unpaidTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFF7ED",
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  unpaidTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },

  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
  },

  cancelBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991B1B",
  },

  totalContainer: {
    alignItems: "flex-end",
  },

  totalLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "black",
    marginBottom: 2,
  },

  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#EF4444",
  },
});