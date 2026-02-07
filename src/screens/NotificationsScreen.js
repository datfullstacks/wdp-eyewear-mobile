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
import {
  getMyNotificationsApi,
  markAllMyNotificationsAsReadApi,
  markMyNotificationAsReadApi,
} from "../services/userService";

function formatTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function NotificationCard({ item, onPress }) {
  const read = Boolean(item?.readAt);
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
      {!!item?.message ? <Text style={styles.message}>{item.message}</Text> : null}
      <Text style={styles.time}>{formatTime(item?.createdAt)}</Text>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await getMyNotificationsApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Khong tai duoc notifications";
      Alert.alert("Notifications", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onMarkRead = async (id) => {
    try {
      const data = await markMyNotificationAsReadApi(id);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Khong danh dau da doc duoc";
      Alert.alert("Notifications", message);
    }
  };

  const onMarkAll = async () => {
    try {
      const data = await markAllMyNotificationsAsReadApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Khong danh dau tat ca duoc";
      Alert.alert("Notifications", message);
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
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={onMarkAll}>
          <Text style={styles.markAll}>Mark all read</Text>
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
            <NotificationCard item={item} onPress={() => onMarkRead(item?._id)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notifications</Text>
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
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
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
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 13.5, fontWeight: "900", color: "#111827", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2563EB" },
  message: { marginTop: 6, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  time: { marginTop: 8, fontSize: 11.5, fontWeight: "700", color: "#9CA3AF" },
  empty: { paddingTop: 20, alignItems: "center" },
  emptyText: { color: "#6B7280", fontWeight: "700" },
});
