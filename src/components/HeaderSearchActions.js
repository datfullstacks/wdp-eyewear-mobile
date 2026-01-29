import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CartIconButton from "./CartIconButton";

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

      <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={onPressFav}>
        <Ionicons name="heart" size={25} color="red" />
      </TouchableOpacity>

      <CartIconButton onPress={onPressCart} />
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
