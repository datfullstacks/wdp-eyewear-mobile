import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MOCK_ORDERS } from "../data/mockOrders";

const STATUS_META = {
  pending: { label: "Chờ xác nhận", color: "#B45309", bg: "#FFF7ED" },
  processing: { label: "Đang xử lý", color: "#1D4ED8", bg: "#EFF6FF" },
  shipping: { label: "Đang giao", color: "#0F766E", bg: "#ECFEFF" },
  delivered: { label: "Đã giao", color: "#15803D", bg: "#ECFDF5" },
  cancelled: { label: "Đã hủy", color: "#991B1B", bg: "#FEE2E2" },
};

const formatVND = (value) => new Intl.NumberFormat("vi-VN").format(value) + "đ";

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function OrderCard({ item }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View>
          <Text style={styles.orderId}>{item.id}</Text>
          <Text style={styles.orderDate}>{item.createdAt}</Text>
        </View>
        <StatusPill status={item.status} />
      </View>

      <View style={styles.cardRow}>
        <Text style={styles.metaLabel}>Số sản phẩm</Text>
        <Text style={styles.metaValue}>{item.itemsCount}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.metaLabel}>Tổng cộng</Text>
        <Text style={styles.totalValue}>{formatVND(item.total)}</Text>
      </View>
    </View>
  );
}

export default function OrdersScreen({ navigation }) {
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

      <FlatList
        data={MOCK_ORDERS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <OrderCard item={item} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={44} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Chưa có đơn hàng</Text>
            <Text style={styles.emptySub}>
              Khi bạn thanh toán thành công, đơn hàng sẽ hiển thị ở đây.
            </Text>
          </View>
        }
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
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  listContent: { paddingHorizontal: 16, paddingBottom: 16 },

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
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderId: { fontSize: 14, fontWeight: "900", color: "#111827" },
  orderDate: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: "900" },

  cardRow: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  metaLabel: { fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  metaValue: { fontSize: 12.5, fontWeight: "900", color: "#111827" },
  totalValue: { fontSize: 13.5, fontWeight: "900", color: "#EF4444" },

  emptyWrap: {
    paddingTop: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  emptySub: { fontSize: 12, fontWeight: "700", color: "#6B7280", textAlign: "center" },
});
