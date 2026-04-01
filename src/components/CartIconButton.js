import React, { useEffect, useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import {
  getCartBadgeQty,
  refreshCartBadgeQty,
  setCartBadgeQty,
  subscribeCartBadgeQty,
} from "../services/cartService";

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

export default function CartIconButton({ onPress }) {
  const token = useAuthStore((s) => s.token);
  const [qty, setQty] = useState(() => getCartBadgeQty());

  useEffect(() => {
    const unsubscribe = subscribeCartBadgeQty(setQty);

    if (!token) {
      setCartBadgeQty(0);
      return unsubscribe;
    }

    refreshCartBadgeQty();
    return unsubscribe;
  }, [token]);

  return (
    <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={onPress}>
      <Ionicons name="cart-outline" size={20} color={PALETTE.navy} />
      {token && qty > 0 ? (
        <View style={styles.cartDot}>
          <Text style={styles.cartDotText}>{qty > 99 ? "99+" : String(qty)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    position: "relative",
  },
  cartDot: {
    position: "absolute",
    right: -6,
    top: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#EF4444", // Màu đỏ
    borderWidth: 1.5,
    borderColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
  },
  cartDotText: { 
    color: PALETTE.white, 
    fontSize: 10, 
    fontWeight: "900",
    lineHeight: 13,
  },
});