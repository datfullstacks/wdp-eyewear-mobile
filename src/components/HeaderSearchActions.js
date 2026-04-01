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
        <Ionicons name="search-outline" size={18} color={PALETTE.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={PALETTE.muted}
          style={[styles.searchInput, inputStyle]}
          returnKeyType="search"
          onSubmitEditing={() => onSubmit?.()}
        />
      </View>

      <CartIconButton onPress={handlePressCart} />

      <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}
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
        }>
        <AntDesign name="comment" size={18} color={PALETTE.navy} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: PALETTE.text,
    marginLeft: 8,
    fontSize: 13,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
});