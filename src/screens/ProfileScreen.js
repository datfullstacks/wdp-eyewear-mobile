import React, { useCallback, useEffect, useState } from "react";
import { Ionicons, MaterialCommunityIcons, AntDesign } from "@expo/vector-icons";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { useAuthStore } from "../store/authStore";
import {
  getMyAddressesApi,
  getMyFavoriteIdsApi,
  getMyNotificationsApi,
  getMyPrescriptionsApi,
} from "../services/userService";
import { getMyOrdersApi } from "../services/orderService";
import {
  connectRealtime,
  isNotificationRealtimeEvent,
} from "../services/realtimeService";
import { useSupportInboxStore } from "../store/supportInboxStore";

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

const STAT_ACCENTS = {
  orders: { bg: PALETTE.navyTint, fg: PALETTE.navy },
  favorites: { bg: "#ffe5e5", fg: "red" },
  addresses: { bg: PALETTE.navyTint, fg: PALETTE.navySoft },
  rx: { bg: PALETTE.goldSoft, fg: PALETTE.navy },
};

const SETTING_ACCENTS = {
  payments: { bg: PALETTE.navy, fg: PALETTE.gold },
  refund: { bg: PALETTE.navy, fg: PALETTE.gold },
  support: { bg: PALETTE.navy, fg: PALETTE.gold },
  noti: { bg: PALETTE.navy, fg: PALETTE.gold },
};

const AVATAR_COLORS = [
  "#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5",
  "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50",
  "#8BC34A", "#CDDC39", "#FFC107", "#FF9800", "#FF5722"
];

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function RowItem({
  icon,
  title,
  subtitle,
  rightText,
  onPress,
  danger,
  accent,
  showBadge = false,
}) {
  const a = accent || { bg: PALETTE.navyTint, fg: PALETTE.navy };
  const bg = danger ? "#ffe5e5" : a.bg;
  const fg = danger ? PALETTE.navy : a.fg;
  const tileColor = danger ? "red" : a.fg;
  const iconName = danger ? "log-out-outline" : icon;
  const iconColor = danger ? "#D92D20" : fg;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: PALETTE.navyTint }}
      style={({ pressed }) => [
        styles.rowItem,
        pressed && Platform.OS === "ios" ? { opacity: 0.7 } : null,
      ]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
        {showBadge ? <View style={styles.rowIconBadge} /> : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: PALETTE.navy, color: tileColor }]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>

      {rightText ? <Text style={styles.rowRightText}>{rightText}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={PALETTE.muted} />
    </Pressable>
  );
}

function LoginRequired({ navigation }) {
  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockCard}>
        <View style={styles.lockIcon}>
          <AntDesign name="lock" size={24} color={PALETTE.navy} />
        </View>

        <Text style={styles.lockTitle}>Bạn cần đăng nhập</Text>
        <Text style={styles.lockDesc}>
          Vui lòng đăng nhập để xem thông tin tài khoản, đơn hàng và yêu thích.
        </Text>

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={({ pressed }) => [styles.lockBtn, pressed && styles.pressedSoft]}
        >
          <Ionicons name="log-in-outline" size={18} color={PALETTE.white} />
          <Text style={styles.lockBtnText}>Đăng nhập</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("HomeTab")}
          style={({ pressed }) => [styles.lockLink, pressed && styles.pressed]}
        >
          <Text style={styles.lockLinkText}>Quay về màn hình chính</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileHeader({ navigation, right }) {
  return (
    <View style={styles.header}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
        >
          <Ionicons name="chevron-back" size={22} color={PALETTE.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>Tài khoản</Text>
      </View>

      {/* {right ?? <View style={styles.iconBtn} />} */}
    </View>
  );
}

function TextAvatar({ name, style }) {
  const firstLetter = name?.trim()?.charAt(0)?.toUpperCase() || "?";

  const getColorFromName = (value) => {
    if (!value) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
  };

  const backgroundColor = getColorFromName(name);

  return (
    <View style={[styles.avatarRing, { backgroundColor: PALETTE.white }, style]}>
      <View
        style={[
          styles.textAvatar,
          { backgroundColor, width: "100%", height: "100%" },
        ]}
      >
        <Text style={styles.textAvatarLetter}>{firstLetter}</Text>
      </View>
    </View>
  );
}

function OrderShortcut({ icon, label, count, onPress, iconSet = "Ionicons", iconSize = 26, iconColor = PALETTE.navy,
}) {
  const IconComponent =
    iconSet === "MaterialCommunityIcons" ? MaterialCommunityIcons : Ionicons;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.orderShortcutItem, pressed && styles.pressedSoft]}
    >
      <View style={styles.orderShortcutIconWrap}>
        <IconComponent name={icon} size={iconSize} color={iconColor} />
        {count > 0 ? (
          <View style={styles.orderBadge}>
            <Text style={styles.orderBadgeText}>{count > 99 ? "99+" : count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.orderShortcutLabel}>{label}</Text>
    </Pressable>
  );
}

const normalizeFavoriteIds = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.favoriteIds)) return payload.favoriteIds;
  return [];
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export default function ProfileScreen({ navigation }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const hasUnreadSupport = useSupportInboxStore((s) => s.unreadTicketIds.length > 0);
  const refreshSupportUnread = useSupportInboxStore((s) => s.refreshUnreadFromApi);

  const [stats, setStats] = useState({
    tier: "Member",
    points: 0,
    pendingOrders: 0,
    favorites: 0,
    addresses: 0,
    prescription: "0",
    orderPending: 0,
    orderWaitingPick: 0,
    orderShipping: 0,
    orderReview: 0,
  });

  useEffect(() => {
    if (token && !user && !isHydrating) {
      fetchMe?.();
    }
  }, [token, user, isHydrating, fetchMe]);

  const loadStats = useCallback(async () => {
    if (!token) return;

    try {
      const [ordersResult, favoriteResult, addressesResult, prescriptionsResult] =
        await Promise.all([
          getMyOrdersApi({ page: 1, limit: 1000 }, { includeItems: false }),
          getMyFavoriteIdsApi(),
          getMyAddressesApi(),
          getMyPrescriptionsApi(),
        ]);

      const orders = normalizeList(ordersResult);
      const favoriteIds = normalizeFavoriteIds(favoriteResult);
      const addressList = normalizeList(addressesResult);
      const prescriptionList = normalizeList(prescriptionsResult);

      const getStatusCount = (status) =>
        orders.filter((order) => String(order?.status || "").toLowerCase() === status).length;

      const pendingOrders = orders.filter((order) => {
        const status = String(order?.status || "").toLowerCase();
        return !["delivered", "cancelled", "returned"].includes(status);
      }).length;

      const orderPending = getStatusCount("pending");
      const orderWaitingPick = orders.filter((order) => {
        const status = String(order?.status || "").toLowerCase();
        return ["confirmed", "processing"].includes(status);
      }).length;
      const orderShipping = getStatusCount("shipped");
      const orderReview = getStatusCount("delivered");

      setStats((prev) => ({
        ...prev,
        pendingOrders,
        favorites: favoriteIds.length,
        addresses: addressList.length,
        prescription: String(prescriptionList.length),
        orderPending,
        orderWaitingPick,
        orderShipping,
        orderReview,
      }));
    } catch (err) {
      // console.log("loadStats error:", err);
    }
  }, [token]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!token) {
      setHasUnreadNotifications(false);
      return;
    }

    try {
      const data = await getMyNotificationsApi();
      const list = Array.isArray(data) ? data : [];
      setHasUnreadNotifications(list.some((item) => !item?.readAt));
    } catch {
      setHasUnreadNotifications(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
      loadUnreadNotifications();
      void refreshSupportUnread().catch(() => {});
    }, [loadStats, loadUnreadNotifications, refreshSupportUnread])
  );

  useEffect(() => {
    if (!token) {
      setHasUnreadNotifications(false);
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      socket = connectRealtime(token, {
        onMessage: (payload) => {
          if (!isNotificationRealtimeEvent(payload)) return;
          void loadUnreadNotifications();
          void refreshSupportUnread().catch(() => {});
        },
        onClose: () => {
          if (isDisposed) return;
          reconnectTimer = setTimeout(() => {
            connect();
          }, 2000);
        },
      });
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [token, loadUnreadNotifications, refreshSupportUnread]);

  if (!token) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
            >
              <Ionicons name="chevron-back" size={22} color="black" />
            </Pressable>
            <Text style={styles.headerTitle}>Tài khoản</Text>
          </View>
        </View>
        <LoginRequired navigation={navigation} />
      </SafeAreaView>
    );
  }

  if (isHydrating || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />
        <ProfileHeader
          navigation={navigation}
          right={
            <Pressable onPress={logout} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={20} color={PALETTE.navy} />
            </Pressable>
          }
        />
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontWeight: "800", color: PALETTE.navy }}>
            Đang tải hồ sơ...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user?.name || "--";
  const displayEmail = user?.email || "--";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      <ProfileHeader
        navigation={navigation}
      // right={
      //   <Pressable
      //     onPress={() => console.log("Edit profile")}
      //     style={styles.iconBtn}
      //   >
      //     <Ionicons name="create-outline" size={20} color={PALETTE.navy} />
      //   </Pressable>
      // }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ padding: 16 }}>
          <View style={styles.profileTop}>
            <TextAvatar name={displayName} />

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{displayEmail}</Text>
            </View>
          </View>
        </Card>

        <Card style={{ paddingVertical: 14, paddingHorizontal: 14 }}>
          <View style={styles.orderSectionHeader}>
            <Text style={styles.orderSectionTitle}>Đơn mua</Text>
            <Pressable
              onPress={() => navigation.navigate("Orders", { initialFilter: "all" })}
              style={({ pressed }) => [styles.orderHistoryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.orderHistoryText}>Lịch sử mua hàng</Text>
              <Ionicons name="chevron-forward" size={16} color={PALETTE.muted} />
            </Pressable>
          </View>

          <View style={styles.orderShortcutRow}>
            <OrderShortcut
              icon="wallet-outline"
              label="Chờ xác nhận"
              count={stats.orderPending}
              onPress={() => navigation.navigate("Orders", { initialFilter: "pending" })}
            />

            <OrderShortcut
              icon="archive-outline"
              label="Chờ lấy hàng"
              count={stats.orderWaitingPick}
              onPress={() => navigation.navigate("Orders", { initialFilter: ["processing", "confirmed"] })}
            />

            <OrderShortcut
              icon="truck-outline"
              iconSet="MaterialCommunityIcons"
              label="Chờ giao hàng"
              count={stats.orderShipping}
              onPress={() => navigation.navigate("Orders", { initialFilter: "shipped" })}
            />

            <OrderShortcut
              icon="star-outline"
              label="Đã giao"
              count={stats.orderReview}
              onPress={() => navigation.navigate("Orders", { initialFilter: "delivered" })}
            />
          </View>
        </Card>

        <Card style={{ padding: 16 }}>
          <View style={styles.statGrid}>
            <Pressable
              onPress={() => navigation.navigate("Orders", { initialFilter: "all" })}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.orders.bg,
                  borderColor: PALETTE.border,
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons
                name="cube-outline"
                size={18}
                color={STAT_ACCENTS.orders.fg}
              />
              <Text style={[styles.statValue, { color: STAT_ACCENTS.orders.fg }]}>
                {stats.pendingOrders}
              </Text>
              <Text style={styles.statLabel}>Đơn hàng</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("FavTab")}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.favorites.bg,
                  borderColor: PALETTE.border,
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons
                name="heart-outline"
                size={18}
                color={STAT_ACCENTS.favorites.fg}
              />
              <Text
                style={[styles.statValue, { color: STAT_ACCENTS.favorites.fg }]}
              >
                {stats.favorites}
              </Text>
              <Text style={styles.statLabel}>Yêu thích</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("AddressBook")}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.addresses.bg,
                  borderColor: PALETTE.border,
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons
                name="location-outline"
                size={18}
                color={STAT_ACCENTS.addresses.fg}
              />
              <Text
                style={[styles.statValue, { color: STAT_ACCENTS.addresses.fg }]}
              >
                {stats.addresses}
              </Text>
              <Text style={styles.statLabel}>Địa chỉ</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Prescription")}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.rx.bg,
                  borderColor: PALETTE.border,
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons
                name="reader-outline"
                size={18}
                color={STAT_ACCENTS.rx.fg}
              />
              <Text style={[styles.statValue, { color: STAT_ACCENTS.rx.fg }]}>
                {stats.prescription}
              </Text>
              <Text style={styles.statLabel}>Đơn kính</Text>
            </Pressable>
          </View>
        </Card>

        <Card style={{ paddingVertical: 6 }}>
          <RowItem
            icon="receipt-outline"
            title="Đơn hàng"
            subtitle="Theo dõi đơn hàng và hoàn trả"
            rightText={`${stats.pendingOrders} đơn`}
            onPress={() => navigation.navigate("Orders", { initialFilter: "all" })}
            accent={STAT_ACCENTS.orders}
          />
          <Divider />
          <RowItem
            icon="heart-outline"
            title="Yêu thích"
            subtitle="Sản phẩm bạn đã yêu thích"
            rightText={`${stats.favorites} sản phẩm`}
            onPress={() => navigation.navigate("FavTab")}
            accent={STAT_ACCENTS.favorites}
          />
          <Divider />
          <RowItem
            icon="reader-outline"
            title="Đơn kính"
            subtitle="PD, Rx, lens preferences"
            rightText="Xem chi tiết"
            onPress={() => navigation.navigate("Prescription")}
            accent={STAT_ACCENTS.rx}
          />
          <Divider />
          <RowItem
            icon="location-outline"
            title="Địa chỉ mặc định"
            subtitle="Địa chỉ giao hàng mặc định"
            rightText={`${stats.addresses}`}
            onPress={() => navigation.navigate("AddressBook")}
            accent={STAT_ACCENTS.addresses}
          />
        </Card>

        <Pressable
          onPress={() => setSettingsExpanded((prev) => !prev)}
          style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
        >
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="settings-outline" size={24} color={PALETTE.navy} />
            <Text style={styles.sectionTitle}>Cài đặt</Text>
          </View>
          <Ionicons
            name={settingsExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={PALETTE.muted}
          />
        </Pressable>

        {settingsExpanded ? (
          <Card style={{ paddingVertical: 6, marginBottom: 18 }}>
            <RowItem
              icon="chatbubble-ellipses-outline"
              title="Hỗ trợ"
              subtitle="Nhắn tin với chúng tôi"
              onPress={() =>
                navigation.navigate("Support", {
                  prefillCategory: "general",
                  lockCategory: false,
                  orderId: "",
                  orderCode: "",
                  orderItemId: "",
                  orderItemName: "",
                  draftSubject: "",
                })
              }
              accent={SETTING_ACCENTS.support}
              showBadge={hasUnreadSupport}
            />
            <Divider />
            <RowItem
              icon="notifications-outline"
              title="Thông báo"
              subtitle="Cập nhật và ưu đãi mới nhất"
              onPress={() => navigation.navigate("Notifications")}
              accent={SETTING_ACCENTS.noti}
              showBadge={hasUnreadNotifications}
            />
            <Divider />
            <RowItem
              icon="log-out-outline"
              title="Đăng xuất"
              subtitle="Đăng xuất khỏi thiết bị này"
              onPress={logout}
              danger
            />
          </Card>
        ) : (
          <View style={styles.sectionSpacer} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },

  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "black" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingHorizontal: 16, paddingBottom: 24 },

  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.navy,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    marginBottom: 12,
  },

  profileTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarRing: {
    width: 74,
    height: 74,
    borderRadius: 999,
    padding: 3,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  textAvatar: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  textAvatarLetter: {
    color: PALETTE.white,
    fontSize: 32,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  name: { fontSize: 18, fontWeight: "800", color: PALETTE.navy },
  email: { marginTop: 2, color: PALETTE.muted, fontWeight: "600" },

  orderSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  orderSectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: PALETTE.navy,
  },
  orderHistoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  orderHistoryText: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  orderShortcutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  orderShortcutItem: {
    flex: 1,
    alignItems: "center",
  },
  orderShortcutIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    backgroundColor: PALETTE.navyTint,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  orderShortcutLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.navySoft,
    width: "100%",
    lineHeight: 16,
    textAlign: "center",
  },
  orderBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: PALETTE.white,
  },
  orderBadgeText: {
    color: PALETTE.white,
    fontSize: 10,
    fontWeight: "900",
  },

  statGrid: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  statItem: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  statValue: { fontSize: 16, fontWeight: "900", width: "100%", textAlign: "center" },
  statLabel: {
    fontSize: 12,
    color: PALETTE.navy,
    fontWeight: "700",
    width: "100%",
    lineHeight: 16,
    textAlign: "center",
  },

  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  rowIconBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: PALETTE.white,
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: PALETTE.text },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: PALETTE.muted,
  },
  rowRightText: {
    fontSize: 12,
    fontWeight: "800",
    color: PALETTE.muted,
    marginRight: 6,
  },
  divider: { height: 1, backgroundColor: PALETTE.border, marginLeft: 62 },

  sectionHeader: {
    marginTop: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: PALETTE.navy },
  sectionSpacer: { height: 18 },

  pressed: { opacity: 0.75 },
  pressedSoft: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  lockScreen: { flex: 1, paddingHorizontal: 16, paddingTop: 30 },
  lockCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 16,
    shadowColor: PALETTE.navy,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    alignItems: "center",
  },
  lockIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: PALETTE.navyTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  lockTitle: { fontSize: 16, fontWeight: "900", color: PALETTE.navy },
  lockDesc: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  lockBtn: {
    marginTop: 14,
    width: "100%",
    height: 46,
    borderRadius: 14,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  lockBtnText: { color: PALETTE.white, fontWeight: "900" },
  lockLink: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: PALETTE.navySoft,
  },
  lockLinkText: { textAlign: "center", color: PALETTE.navySoft, fontWeight: "900", borderRadius: 12 },
});
