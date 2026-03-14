import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import {
  getMyNotificationsApi,
  markAllMyNotificationsAsReadApi,
  markMyNotificationAsReadApi,
} from "../services/userService";
import {
  connectRealtime,
  isNotificationRealtimeEvent,
} from "../services/realtimeService";

function formatTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function formatStatus(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";

  const labels = {
    confirmed: "Da xac nhan",
    processing: "Dang xu ly",
    shipped: "Dang giao",
    delivered: "Da giao",
    cancelled: "Da huy",
    returned: "Hoan hang",
    picking: "Dang lay hang",
    packing: "Dang dong goi",
    ready_to_ship: "San sang tao van don",
    shipment_created: "Da tao van don",
    handover_to_carrier: "Da ban giao GHN",
    in_transit: "Dang van chuyen",
    delivery_failed: "Giao that bai",
    waiting_redelivery: "Cho giao lai",
    return_pending: "Cho hoan hang",
    return_in_transit: "Dang hoan hang",
    waiting_customer_info: "Can bo sung thong tin",
    on_hold: "Tam dung xu ly",
    exception_hold: "Su co giao van",
    ready_to_pick: "Cho GHN lay hang",
    transporting: "Dang van chuyen",
  };

  return labels[raw] || raw;
}

function NotificationCard({ item, onPress }) {
  const read = Boolean(item?.readAt);
  const orderCode = String(item?.data?.orderCode || "").trim();
  const trackingCode = String(item?.data?.trackingCode || "").trim();
  const orderStatus = formatStatus(item?.data?.orderStatus);
  const opsStage = formatStatus(item?.data?.opsStage);
  const shippingStatus = formatStatus(item?.data?.shippingStatus);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.card, read ? styles.cardRead : styles.cardUnread]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item?.title || "Notification"}</Text>
        {!read ? <View style={styles.unreadDot} /> : null}
      </View>

      {!!item?.message ? (
        <Text style={styles.message}>{item.message}</Text>
      ) : null}

      {orderCode ||
      trackingCode ||
      orderStatus ||
      opsStage ||
      shippingStatus ? (
        <View style={styles.metaWrap}>
          {!!orderCode ? (
            <Text style={styles.metaText}>Ma don: {orderCode}</Text>
          ) : null}
          {!!trackingCode ? (
            <Text style={styles.metaText}>Ma van don: {trackingCode}</Text>
          ) : null}
          {!!orderStatus ? (
            <Text style={styles.metaText}>Trang thai don: {orderStatus}</Text>
          ) : null}
          {!!opsStage ? (
            <Text style={styles.metaText}>Tien do xu ly: {opsStage}</Text>
          ) : null}
          {!!shippingStatus ? (
            <Text style={styles.metaText}>GHN: {shippingStatus}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.time}>{formatTime(item?.createdAt)}</Text>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen({ navigation }) {
  const authToken = useAuthStore((s) => s.token);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await getMyNotificationsApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Khong tai duoc thong bao";
      Alert.alert("Notifications", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (!authToken) {
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) {
        return;
      }

      socket = connectRealtime(authToken, {
        onMessage: (payload) => {
          if (!isNotificationRealtimeEvent(payload)) {
            return;
          }

          void loadData();
        },
        onClose: () => {
          if (isDisposed) {
            return;
          }

          reconnectTimer = setTimeout(() => {
            connect();
          }, 2000);
        },
      });
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [authToken, loadData]);

  const onMarkRead = async (item) => {
    try {
      const data = await markMyNotificationAsReadApi(item?._id);
      setItems(Array.isArray(data) ? data : []);
      if (item?.data?.orderId) {
        navigation.navigate("Orders");
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Khong danh dau da doc duoc";
      Alert.alert("Notifications", message);
    }
  };

  const onMarkAll = async () => {
    try {
      const data = await markAllMyNotificationsAsReadApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Khong danh dau tat ca duoc";
      Alert.alert("Notifications", message);
    }
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
          <Text style={styles.headerTitle}>Thong bao</Text>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={onMarkAll}>
          <Text style={styles.markAll}>Danh dau doc tat ca</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item?._id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <NotificationCard item={item} onPress={() => onMarkRead(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Khong co thong bao</Text>
            </View>
          }
        />
      )}
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
  markAll: { color: "#2563EB", fontWeight: "900", fontSize: 12.5 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardRead: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
  },
  cardUnread: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { fontSize: 13.5, fontWeight: "900", color: "#111827", flex: 1 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  message: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  metaWrap: { marginTop: 8, gap: 3 },
  metaText: { fontSize: 11.5, fontWeight: "700", color: "#374151" },
  time: { marginTop: 8, fontSize: 11.5, fontWeight: "700", color: "#9CA3AF" },
  empty: { paddingTop: 20, alignItems: "center" },
  emptyText: { color: "#6B7280", fontWeight: "700" },
});
