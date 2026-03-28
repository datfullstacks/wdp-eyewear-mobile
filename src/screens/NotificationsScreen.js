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
import { Ionicons, AntDesign } from "@expo/vector-icons";
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

const PALETTE = {
  navy: "#0c2c5c",
  navySoft: "#17365D",
  navyTint: "#EEF3F8",
  gold: "#fcd675",
  goldSoft: "#F5E9C8",
  white: "#FFFFFF",
  bg: "#F7F8FA",
  text: "#162033",
  muted: "#6B7280",
  border: "#E3E8EF",
};

function formatStatus(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (!raw) return "";

  const labels = {
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
  };

  return labels[raw] || raw;
}

function normalizeRefundStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
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
        <Text style={styles.title}>{item?.title || "Thông báo"}</Text>
        {!read ? <View style={styles.unreadDot} /> : null}
      </View>

      {!!item?.message ? (
        <Text style={styles.message}>{item.message}</Text>
      ) : null}

      {orderCode || trackingCode || orderStatus || opsStage || shippingStatus ? (
        <View style={styles.metaWrap}>
          {!!orderCode ? (
            <Text style={styles.metaText}>Mã đơn: {orderCode}</Text>
          ) : null}
          {!!trackingCode ? (
            <Text style={styles.metaText}>Mã vận đơn: {trackingCode}</Text>
          ) : null}
          {!!orderStatus ? (
            <Text style={styles.metaText}>Trạng thái đơn: {orderStatus}</Text>
          ) : null}
          {!!opsStage ? (
            <Text style={styles.metaText}>Tiến độ xử lý: {opsStage}</Text>
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

export default function NotificationsScreen({ navigation, onNotificationsChanged }) {
  const authToken = useAuthStore((s) => s.token);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await getMyNotificationsApi();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      onNotificationsChanged?.();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Không tải được thông báo";
      Alert.alert("Thông báo", message);
    } finally {
      setLoading(false);
    }
  }, [onNotificationsChanged]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      onNotificationsChanged?.();

      const refundStatus = normalizeRefundStatus(item?.data?.refundStatus);
      const refundNextAction = normalizeRefundStatus(item?.data?.nextActionCode);

      if (
        item?.data?.orderId &&
        (refundStatus === "waiting_customer_info" ||
          refundNextAction === "customer_submit_info")
      ) {
        navigation.navigate("CartFlow", {
          screen: "RefundRequest",
          params: {
            orderId: item.data.orderId,
            refundAction: "customer_submit_info",
            source: "notification",
          },
        });
      } else if (item?.data?.orderId) {
        navigation.navigate("ProfileTab", {
          screen: "OrderDetail",
          params: {
            orderId: item.data.orderId,
          },
        });
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Không đánh dấu đã đọc được";
      Alert.alert("Thông báo", message);
    }
  };

  const onMarkAll = async () => {
    try {
      const data = await markAllMyNotificationsAsReadApi();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      onNotificationsChanged?.();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Không đánh dấu tất cả được";
      Alert.alert("Thông báo", message);
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
          <Text style={styles.headerTitle}>Thông báo</Text>
        </View>

        <TouchableOpacity style={{backgroundColor: PALETTE.navy, paddingVertical: 5, paddingHorizontal: 15, borderRadius: 50 }} activeOpacity={0.85} onPress={onMarkAll}>
          <Text style={styles.markAll}><AntDesign name="tag" size={15} color={PALETTE.gold} />  Đọc tất cả</Text>
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
              <Text style={styles.emptyText}>Không có thông báo</Text>
            </View>
          }
        />
      )}
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

  markAll: {
    color: PALETTE.gold,
    fontWeight: "900",
    fontSize: 14,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

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

  title: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#111827",
    flex: 1,
  },

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

  metaWrap: {
    marginTop: 8,
    gap: 3,
  },

  metaText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#374151",
  },

  time: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  empty: {
    paddingTop: 20,
    alignItems: "center",
  },

  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
  },
});
