// components/CartIconButton.js
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";

export default function CartIconButton({ onPress }) {
  const token = useAuthStore((s) => s.token);

  const items = useCartStore((s) => s.items);
  const preorderItems = useCartStore((s) => s.preorderItems);
  const isHydrating = useCartStore((s) => s.isHydrating);

  const qty = token
    ? [...items, ...preorderItems].reduce((sum, it) => sum + (it.qty || 0), 0)
    : 0;

  return (
    <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={onPress}>
      <Ionicons name="cart-outline" size={25} color="blue" />
      {token && !isHydrating && qty > 0 ? (
        <View style={styles.cartDot}>
          <Text style={styles.cartDotText}>{qty > 9 ? "9+" : String(qty)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartDot: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  cartDotText: { color: "white", fontSize: 11, fontWeight: "800" },
});

