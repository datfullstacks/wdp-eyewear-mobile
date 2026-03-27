import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import CartIconButton from "./CartIconButton";
import { useAuthStore } from "../store/authStore";

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

export default function HeaderSearchActions({
  value,
  onChangeText,
  placeholder = "Tìm gọng kính, tròng kính, dịch vụ...",
  onPressFav,
  onPressCart,
  onSubmit,
  containerStyle,
  inputStyle,
}) {
  const navigation = useNavigation();
  const token = useAuthStore((s) => s.token);

  const requireLogin = (after) => {
    Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập để sử dụng tính năng này.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng nhập",
        onPress: () => navigation.navigate("Login", { next: after || null }),
      },
    ]);
  };

  const handlePressCart = () => {
    if (!token) return requireLogin("CartFlow", { screen: "Cart" });
    if (onPressCart) return onPressCart();
    navigation.navigate("CartFlow", { screen: "Cart" });
  };

  return (
    <View style={[styles.row, containerStyle]}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9AA4B2" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9AA4B2"
          style={[styles.searchInput, inputStyle]}
          returnKeyType="search"
          onSubmitEditing={() => onSubmit?.()}
        />
      </View>

      <CartIconButton onPress={handlePressCart} />
      <View>
        <AntDesign name="comment" size={25} color={PALETTE.navy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: "#111827" },
});
