// screens/OrdersScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getMyOrdersApi, patchOrderItemApi } from "../services/orderService";
import OrderItemEditModal from "../components/OrderItemEditModal";

const STATUS_META = {
  pending: { label: "Chờ xác nhận", color: "#B45309", bg: "#FFF7ED" },
  confirmed: { label: "Đã xác nhận", color: "#1D4ED8", bg: "#EFF6FF" },
  processing: { label: "Đang xử lý", color: "#1D4ED8", bg: "#EFF6FF" },
  shipped: { label: "Đang giao", color: "#0F766E", bg: "#ECFEFF" },
  delivered: { label: "Đã giao", color: "#15803D", bg: "#ECFDF5" },
  cancelled: { label: "Đã hủy", color: "#991B1B", bg: "#FEE2E2" },
  returned: { label: "Đã trả", color: "#6B7280", bg: "#F3F4F6" },
};

const TYPE_META = {
  lens: { icon: "eye-outline", color: "#2563EB", bg: "#EFF6FF" },
  contact_lens: { icon: "eye-outline", color: "#2563EB", bg: "#EFF6FF" },
  frame: { icon: "glasses-outline", color: "#6B7280", bg: "#F3F4F6" },
  sunglasses: { icon: "glasses-outline", color: "#B45309", bg: "#FFF7ED" },
  accessory: { icon: "grid-outline", color: "#6B7280", bg: "#F3F4F6" },
  service: { icon: "build-outline", color: "#15803D", bg: "#ECFDF5" },
};

const formatVND = (v) =>
  new Intl.NumberFormat("vi-VN").format(Number(v || 0)) + "đ";

const formatDate = (v) => {
  if (!v) return "--";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("vi-VN", { hour12: false });
};

function StatusPill({ status }) {
  const key = String(status || "pending").toLowerCase();
  const meta = STATUS_META[key] || STATUS_META.pending;
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function OrderItemRow({ orderItem, onEdit }) {
  const typeKey = String(orderItem?.type || "").toLowerCase();
  const typeMeta =
    TYPE_META[typeKey] || { icon: "cube-outline", color: "#6B7280", bg: "#F3F4F6" };
  const hasImage = Boolean(orderItem?.image);

  return (
    <View style={styles.orderItemRow}>
      {hasImage ? (
        <Image source={{ uri: orderItem.image }} style={styles.itemThumb} />
      ) : (
        <View style={[styles.itemThumbIcon, { backgroundColor: typeMeta.bg }]}>
          <Ionicons name={typeMeta.icon} size={18} color={typeMeta.color} />
        </View>
      )}

      <View style={styles.orderItemMid}>
        <Text style={styles.orderItemName} numberOfLines={2}>
          {orderItem?.name || "Sản phẩm"}
        </Text>

        <Text style={styles.orderItemMeta}>
          x{orderItem?.qty ?? 1} · {formatVND(orderItem?.price)}{" "}
          {orderItem?.preorder ? (
            <Text style={styles.preorderBadge}>· Đặt trước</Text>
          ) : null}
        </Text>

        {(orderItem?.payLater ?? 0) > 0 && (
          <Text style={styles.payLaterNote}>
            {"Còn thanh toán: " + formatVND(orderItem.payLater)}
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.editItemBtn} activeOpacity={0.8} onPress={onEdit}>
        <Ionicons name="pencil" size={12} color="#2563EB" />
        <Text style={styles.editItemBtnText}>Sửa</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrderCard({ order, onEditItem }) {
  const orderId = order?._id || order?.id || "--";
  const orderItems = Array.isArray(order?.items) ? order.items : [];

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId} numberOfLines={1}>
            {orderId}
          </Text>
          <Text style={styles.orderDate}>{formatDate(order?.createdAt)}</Text>
        </View>
        <StatusPill status={order?.status} />
      </View>

      {orderItems.length > 0 && (
        <View style={styles.itemsList}>
          {orderItems.map((item, idx) => (
            <OrderItemRow
              key={orderId + "-" + idx}
              orderItem={item}
              onEdit={() => onEditItem(item, order)}
            />
          ))}
        </View>
      )}

      <View style={styles.cardDivider} />

      <View style={styles.cardFooter}>
        {order?.paymentStatus === "paid" ? (
          <View style={styles.paidTag}>
            <Ionicons name="checkmark-circle" size={12} color="#15803D" />
            <Text style={styles.paidTagText}>Đã thanh toán</Text>
          </View>
        ) : (
          <View style={styles.unpaidTag}>
            <Ionicons name="time-outline" size={12} color="#B45309" />
            <Text style={styles.unpaidTagText}>Chưa thanh toán</Text>
          </View>
        )}

        <View style={styles.footerRight}>
          <Text style={styles.totalLabel}>Tổng</Text>
          <Text style={styles.totalValue}>{formatVND(order?.total)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [editingOrderItem, setEditingOrderItem] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const result = await getMyOrdersApi({ page: 1, limit: 50 }, true);
      setOrders(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      const data = err?.response?.data || {};
      setError(data.message || data.error || err?.message || "Không tải được đơn hàng");
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleEditItem = useCallback((orderItem, order) => {
    setEditingOrderItem(orderItem);
    setEditingOrder(order);
  }, []);

  const handleSavePatch = useCallback(async (patch) => {
    if (isSavingEdit) return;
    if (!editingOrderItem || !editingOrder) return;

    const orderId = editingOrder?._id || editingOrder?.id || null;
    const itemId = editingOrderItem?.itemId || editingOrderItem?._id || null;

    if (!orderId || !itemId) {
      Alert.alert("Không thể cập nhật", "Thiếu thông tin orderId/itemId.");
      return;
    }

    try {
      setIsSavingEdit(true);
      await patchOrderItemApi(orderId, itemId, editingOrderItem, patch);
      await loadOrders({ silent: true });
      setEditingOrderItem(null);
      setEditingOrder(null);
    } catch (err) {
      const data = err?.response?.data || {};
      const errors = Array.isArray(data?.errors)
        ? data.errors.map((e) => e?.msg).filter(Boolean).join("\n")
        : null;
      const message = errors || data?.message || data?.error || err?.message;
      Alert.alert("Cập nhật thất bại", message || "Không thể cập nhật sản phẩm trong đơn.");
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingOrderItem, editingOrder, isSavingEdit, loadOrders]);

  const emptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.emptySub}>Đang tải đơn hàng...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="receipt-outline" size={44} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Chưa có đơn hàng</Text>
        <Text style={styles.emptySub}>Đơn hàng sẽ hiển thị ở đây sau khi thanh toán.</Text>
      </View>
    );
  }, [loading]);

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
          <Text style={styles.headerTitle}>Đơn hàng</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => loadOrders()}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item?._id || item?.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <OrderCard order={item} onEditItem={handleEditItem} />}
        ListEmptyComponent={emptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrders({ silent: true });
            }}
          />
        }
      />

      <OrderItemEditModal
        visible={Boolean(editingOrderItem)}
        orderItem={editingOrderItem}
        orderCreatedAt={editingOrder?.createdAt}
        onClose={() => {
          if (isSavingEdit) return;
          setEditingOrderItem(null);
          setEditingOrder(null);
        }}
        onSave={handleSavePatch}
        isSaving={isSavingEdit}
      />
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
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  errorText: { flex: 1, color: "#991B1B", fontWeight: "700", fontSize: 12.5 },
  retryText: { color: "#1D4ED8", fontWeight: "900", fontSize: 12.5 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  orderId: { fontSize: 13, fontWeight: "900", color: "#111827" },
  orderDate: { marginTop: 3, fontSize: 11.5, fontWeight: "700", color: "#9CA3AF" },

  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11.5, fontWeight: "900" },

  itemsList: { gap: 8, marginBottom: 4 },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#F6F7FB",
    borderRadius: 12,
  },
  itemThumb: { width: 48, height: 40, borderRadius: 10, backgroundColor: "#E5E7EB", flexShrink: 0 },
  itemThumbIcon: {
    width: 48,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  orderItemMid: { flex: 1 },
  orderItemName: { fontSize: 12.5, fontWeight: "800", color: "#111827", lineHeight: 17 },
  orderItemMeta: { fontSize: 11.5, fontWeight: "700", color: "#6B7280", marginTop: 2 },
  payLaterNote: { fontSize: 11, fontWeight: "700", color: "#B45309", marginTop: 2 },

  editItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    flexShrink: 0,
  },
  editItemBtnText: { fontSize: 12, fontWeight: "800", color: "#2563EB" },

  cardDivider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 10 },

  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  totalLabel: { fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  totalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },

  paidTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
  },
  paidTagText: { fontSize: 11.5, fontWeight: "800", color: "#15803D" },

  unpaidTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
  },
  unpaidTagText: { fontSize: 11.5, fontWeight: "800", color: "#B45309" },

  emptyWrap: { paddingTop: 48, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  emptySub: { fontSize: 12, fontWeight: "700", color: "#6B7280", textAlign: "center" },
  preorderBadge: {
    color: "#15803D",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontWeight: "900",
    fontSize: 11.5,
    overflow: "hidden",
  },
});
