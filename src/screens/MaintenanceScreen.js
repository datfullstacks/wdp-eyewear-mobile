import React, { useCallback } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../store/authStore";
import { useSystemConfigStore } from "../store/systemConfigStore";

export default function MaintenanceScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refresh = useSystemConfigStore((s) => s.refresh);
  const loading = useSystemConfigStore((s) => s.loading);
  const error = useSystemConfigStore((s) => s.error);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
    } catch {
      // Keep the screen state-driven by the store error.
    }
  }, [refresh]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="construct-outline" size={30} color="#B45309" />
        </View>

        <Text style={styles.title}>Hệ thống đang bảo trì</Text>
        <Text style={styles.subtitle}>
          Một số luồng mua hàng đang được tạm dừng theo system config. Vui lòng thử lại sau.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.primaryBtn}
          disabled={loading}
          onPress={handleRefresh}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Tải lại cấu hình</Text>
          )}
        </TouchableOpacity>

        {!user ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.secondaryBtnText}>Đăng nhập admin</Text>
          </TouchableOpacity>
        ) : null}

        {user ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.secondaryBtn}
            onPress={async () => {
              await logout();
            }}
          >
            <Text style={styles.secondaryBtnText}>Đăng xuất</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.linkBtn}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.linkBtnText}>Tạo tài khoản khác</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFF8ED",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: "#F5D7AA",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFF1D6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
    color: "#6B7280",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: "#B91C1C",
  },
  primaryBtn: {
    marginTop: 20,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D97706",
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  linkBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
  },
});
