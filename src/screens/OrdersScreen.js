import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getMyOrdersApi } from "../services/orderService";

const STATUS_META = {
  pending: { label: "Cho xac nhan", color: "#B45309", bg: "#FFF7ED" },
  confirmed: { label: "Da xac nhan", color: "#1D4ED8", bg: "#EFF6FF" },
  processing: { label: "Dang xu ly", color: "#1D4ED8", bg: "#EFF6FF" },
  shipped: { label: "Dang giao", color: "#0F766E", bg: "#ECFEFF" },
  delivered: { label: "Da giao", color: "#15803D", bg: "#ECFDF5" },
  cancelled: { label: "Da huy", color: "#991B1B", bg: "#FEE2E2" },
  returned: { label: "Da tra", color: "#6B7280", bg: "#F3F4F6" },
};

const formatVND = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "d";

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", { hour12: false });
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

function OrderCard({ item, navigation }) {
  const orderId = item?._id || item?.id || "--";
  const itemsCount = Array.isArray(item?.items) ? item.items.length : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.card}
      onPress={() =>
        navigation.navigate("CartFlow", {
          screen: "CheckoutStatus",
          params: { order: item },
        })
      }
    >
      <View style={styles.cardTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{orderId}</Text>
          <Text style={styles.orderDate}>{formatDate(item?.createdAt)}</Text>
        </View>
        <StatusPill status={item?.status} />
      </View>

      <View style={styles.cardRow}>
        <Text style={styles.metaLabel}>So san pham</Text>
        <Text style={styles.metaValue}>{itemsCount}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.metaLabel}>Tong cong</Text>
        <Text style={styles.totalValue}>{formatVND(item?.total)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const result = await getMyOrdersApi({ page: 1, limit: 50 });
      setOrders(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      const data = err?.response?.data || {};
      setError(data.message || data.error || err?.message || "Khong tai duoc don hang");
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const emptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.emptySub}>Dang tai danh sach don hang...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="receipt-outline" size={44} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Chua co don hang</Text>
        <Text style={styles.emptySub}>
          Khi ban thanh toan thanh cong, don hang se hien thi o day.
        </Text>
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
          <Text style={styles.headerTitle}>Don hang</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => loadOrders()}>
            <Text style={styles.retryText}>Thu lai</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item?._id || item?.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <OrderCard item={item} navigation={navigation} />}
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

  listContent: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },

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
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
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
