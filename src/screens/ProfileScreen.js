// screens/ProfileScreen.js
import React, { useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
import { useAuthStore } from "../store/authStore";

const AVATAR_URI =
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=320&q=80";

// Accent colors
const STAT_ACCENTS = {
  orders: { bg: "#EEF2FF", fg: "#4F46E5" },
  favorites: { bg: "#FCE7F3", fg: "#DB2777" },
  addresses: { bg: "#ECFDF5", fg: "#059669" },
  rx: { bg: "#EFF6FF", fg: "#2563EB" },
};

const SETTING_ACCENTS = {
  payments: { bg: "#FFFBEB", fg: "#D97706" },
  support: { bg: "#F3E8FF", fg: "#7C3AED" },
  noti: { bg: "#ECFEFF", fg: "#0891B2" },
};

/* -------------------- UI primitives -------------------- */

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function RowItem({ icon, title, subtitle, rightText, onPress, danger, accent }) {
  const a = accent || { bg: "#F3F4F6", fg: "#111827" };
  const bg = danger ? "#FFE8E8" : a.bg;
  const fg = danger ? "#D92D20" : a.fg;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      style={({ pressed }) => [
        styles.rowItem,
        pressed && Platform.OS === "ios" ? { opacity: 0.7 } : null,
      ]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={fg} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: "#D92D20" }]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>

      {rightText ? <Text style={styles.rowRightText}>{rightText}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </Pressable>
  );
}

function Pill({ label, icon }) {
  return (
    <View style={styles.pill}>
      {icon ? <Ionicons name={icon} size={14} color="#1F2A37" /> : null}
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

/* -------------------- Logged-out gate -------------------- */

function LoginRequired({ navigation }) {
  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockCard}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed-outline" size={22} color="#111827" />
        </View>

        <Text style={styles.lockTitle}>Bạn cần đăng nhập</Text>
        <Text style={styles.lockDesc}>
          Vui lòng đăng nhập để xem thông tin tài khoản, đơn hàng và yêu thích.
        </Text>

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={({ pressed }) => [styles.lockBtn, pressed && styles.pressedSoft]}
        >
          <Ionicons name="log-in-outline" size={18} color="#fff" />
          <Text style={styles.lockBtnText}>Đăng nhập</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("HomeTab")}
          style={({ pressed }) => [styles.lockLink, pressed && styles.pressed]}
        >
          <Text style={styles.lockLinkText}>Quay về Trang chủ</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* -------------------- Header (same format as Favorites) -------------------- */

function ProfileHeader({ right }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.iconBtn} />{/* placeholder để cân layout như Favorites */}
        <Text style={styles.headerTitle}>Tài khoản</Text>
      </View>

      {right ?? <View style={styles.iconBtn} />}
    </View>
  );
}

/* -------------------- Screen -------------------- */

export default function ProfileScreen({ navigation }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  // ✅ Nếu có token mà chưa có user (hoặc vừa mở app) => gọi /me
  useEffect(() => {
    if (token && !user && !isHydrating) {
      fetchMe?.();
    }
  }, [token, user, isHydrating, fetchMe]);

  // ✅ Nếu chưa login
  if (!token) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F6F8FB" />
        <ProfileHeader />
        <LoginRequired navigation={navigation} />
      </SafeAreaView>
    );
  }

  // ✅ Loading state khi đang hydrate hoặc đang fetch user
  if (isHydrating || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F6F8FB" />

        <ProfileHeader
          right={
            <Pressable onPress={logout} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={20} color="#111827" />
            </Pressable>
          }
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontWeight: "800", color: "#111827" }}>
            Đang tải hồ sơ...
          </Text>
          <Text style={{ marginTop: 6, fontWeight: "600", color: "#6B7280" }}>
            Nếu bị kẹt, kiểm tra token / Authorization header.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== User thật =====
  const displayName = user?.name || "—";
  const displayEmail = user?.email || "—";

  // (Tạm thời) stats demo
  const stats = {
    // tier: "Member",
    // points: 0,
    pendingOrders: 0,
    favorites: 0,
    addresses: 0,
    prescription: "—",
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F8FB" />

      {/* Header: same format as Favorites */}
      <ProfileHeader
        right={
          <Pressable
            onPress={() => console.log("Edit profile")}
            style={styles.iconBtn}
          >
            <Ionicons name="create-outline" size={20} color="#111827" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <Card style={{ padding: 16 }}>
          <View style={styles.profileTop}>
            <View style={styles.avatarRing}>
              <Image
                source={{ uri: AVATAR_URI }}
                style={styles.avatar}
                contentFit="cover"
                transition={150}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{displayEmail}</Text>

              {/* <View style={styles.pillRow}>
                <Pill icon="sparkles-outline" label={stats.tier} />
                <Pill icon="trophy-outline" label={`${stats.points} pts`} />
              </View> */}
            </View>
          </View>

          {/* Quick stats */}
          <View style={styles.statGrid}>
            <Pressable
              onPress={() => navigation.navigate("Orders")}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.orders.bg,
                  borderColor: "rgba(79,70,229,0.18)",
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons name="cube-outline" size={18} color={STAT_ACCENTS.orders.fg} />
              <Text style={[styles.statValue, { color: STAT_ACCENTS.orders.fg }]}>
                {stats.pendingOrders}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Favorites")}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.favorites.bg,
                  borderColor: "rgba(219,39,119,0.18)",
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons name="heart-outline" size={18} color={STAT_ACCENTS.favorites.fg} />
              <Text style={[styles.statValue, { color: STAT_ACCENTS.favorites.fg }]}>
                {stats.favorites}
              </Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("AddressBook")}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.addresses.bg,
                  borderColor: "rgba(5,150,105,0.18)",
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons name="location-outline" size={18} color={STAT_ACCENTS.addresses.fg} />
              <Text style={[styles.statValue, { color: STAT_ACCENTS.addresses.fg }]}>
                {stats.addresses}
              </Text>
              <Text style={styles.statLabel}>Addresses</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Prescription")}
              style={({ pressed }) => [
                styles.statItem,
                {
                  backgroundColor: STAT_ACCENTS.rx.bg,
                  borderColor: "rgba(37,99,235,0.18)",
                },
                pressed && styles.pressedSoft,
              ]}
            >
              <Ionicons name="reader-outline" size={18} color={STAT_ACCENTS.rx.fg} />
              <Text style={[styles.statValue, { color: STAT_ACCENTS.rx.fg }]}>
                {stats.prescription}
              </Text>
              <Text style={styles.statLabel}>Rx</Text>
            </Pressable>
          </View>
        </Card>

        {/* Actions */}
        <Card style={{ paddingVertical: 6 }}>
          <RowItem
            icon="receipt-outline"
            title="My Orders"
            subtitle="Track shipping & returns"
            rightText={`${stats.pendingOrders} pending`}
            onPress={() => navigation.navigate("Orders")}
            accent={{ bg: "#EEF2FF", fg: "#4F46E5" }}
          />
          <Divider />
          <RowItem
            icon="heart-outline"
            title="Favorites"
            subtitle="Saved frames & lenses"
            rightText={`${stats.favorites} items`}
            onPress={() => navigation.navigate("Favorites")}
            accent={{ bg: "#FCE7F3", fg: "#DB2777" }}
          />
          <Divider />
          <RowItem
            icon="reader-outline"
            title="My Prescription"
            subtitle="PD, Rx, lens preferences"
            rightText="View"
            onPress={() => navigation.navigate("Prescription")}
            accent={{ bg: "#EFF6FF", fg: "#2563EB" }}
          />
          <Divider />
          <RowItem
            icon="location-outline"
            title="Address Book"
            subtitle="Default shipping address"
            rightText={`${stats.addresses}`}
            onPress={() => navigation.navigate("AddressBook")}
            accent={{ bg: "#ECFDF5", fg: "#059669" }}
          />
        </Card>

        {/* Settings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>

        <Card style={{ paddingVertical: 6, marginBottom: 18 }}>
          <RowItem
            icon="card-outline"
            title="Payments"
            subtitle="Cards & billing"
            onPress={() => navigation.navigate("Payments")}
            accent={SETTING_ACCENTS.payments}
          />
          <Divider />
          <RowItem
            icon="chatbubble-ellipses-outline"
            title="Support"
            subtitle="Chat with us"
            onPress={() => navigation.navigate("Support")}
            accent={SETTING_ACCENTS.support}
          />
          <Divider />
          <RowItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Order updates & deals"
            onPress={() => navigation.navigate("Notifications")}
            accent={SETTING_ACCENTS.noti}
          />
          <Divider />
          <RowItem
            icon="log-out-outline"
            title="Sign out"
            subtitle="Log out of this device"
            onPress={logout}
            danger
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F8FB" },

  // ✅ Header giống Favorites
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

  content: { paddingHorizontal: 16, paddingBottom: 24 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.07)",
    shadowColor: "#000",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.18)",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 999 },

  name: { fontSize: 18, fontWeight: "800", color: "#111827" },
  email: { marginTop: 2, color: "#6B7280", fontWeight: "600" },

  pillRow: { marginTop: 10, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  pillText: { color: "#111827", fontWeight: "700", fontSize: 12 },

  statGrid: {
    marginTop: 14,
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
  statValue: { fontSize: 16, fontWeight: "900" },
  statLabel: { fontSize: 12, color: "#6B7280", fontWeight: "700" },

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
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  rowSubtitle: { marginTop: 2, fontSize: 12, fontWeight: "600", color: "#6B7280" },
  rowRightText: { fontSize: 12, fontWeight: "800", color: "#6B7280", marginRight: 6 },

  divider: { height: 1, backgroundColor: "rgba(17,24,39,0.06)", marginLeft: 62 },

  sectionHeader: {
    marginTop: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },

  // pressed helpers
  pressed: { opacity: 0.75 },
  pressedSoft: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  // Logged-out UI
  lockScreen: { flex: 1, paddingHorizontal: 16, paddingTop: 30 },
  lockCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.07)",
    padding: 16,
    shadowColor: "#000",
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  lockTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  lockDesc: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  lockBtn: {
    marginTop: 14,
    width: "100%",
    height: 46,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  lockBtnText: { color: "#fff", fontWeight: "900" },
  lockLink: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },
  lockLinkText: { color: "#2563EB", fontWeight: "900" },
});
