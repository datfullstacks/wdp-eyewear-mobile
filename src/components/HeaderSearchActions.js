import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import CartIconButton from "./CartIconButton";
import { useAuthStore } from "../store/authStore";

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

  const handlePressFav = () => {
    if (!token) return requireLogin("FavTab");
    if (onPressFav) return onPressFav();
    navigation.navigate("FavTab");
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

      <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={handlePressFav}>
        <Ionicons name="heart" size={25} color="red" />
      </TouchableOpacity>

      <CartIconButton onPress={handlePressCart} />
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
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
