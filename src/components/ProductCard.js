import React from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFavoriteStore } from "../store/favoriteStore";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v) + "đ";

// fallback nếu item.image rỗng
const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80";

export default function ProductCard({ item, onPress }) {
  const navigation = useNavigation();
  const token = useAuthStore((s) => s.token);
  const toggleFav = useFavoriteStore((s) => s.toggle);

  const requireLogin = () => {
    Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập để thêm yêu thích.", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng nhập", onPress: () => navigation.navigate("Login") },
    ]);
  };

  const fav = useFavoriteStore((s) => s.ids.includes(item?.id));

  const handleFavPress = () => {
    if (!token) return requireLogin();
    if (!item?.id) return;

    if (fav) {
      Alert.alert(
        "Bỏ yêu thích?",
        `Bạn muốn bỏ "${item?.name ?? "sản phẩm"}" khỏi danh sách yêu thích?`,
        [
          { text: "Hủy", style: "cancel" },
          { text: "Bỏ", style: "destructive", onPress: () => toggleFav(item) },
        ]
      );
    } else {
      toggleFav(item);
      Alert.alert("Đã thêm yêu thích", `"${item?.name ?? "Sản phẩm"}" đã được thêm vào yêu thích.`);
    }
  };

  const img = item?.image || item?.posterUrl || FALLBACK_IMG;
  const brand = item?.brand ? String(item.brand) : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* IMAGE full-bleed */}
      <View style={styles.media}>
        <Image source={{ uri: img }} style={styles.image} />

        {!!item?.discountPct && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>-{item.discountPct}%</Text>
          </View>
        )}

        <TouchableOpacity style={styles.favBtn} activeOpacity={0.85} onPress={handleFavPress}>
          <Ionicons
            name={fav ? "heart" : "heart-outline"}
            size={18}
            color={fav ? "#EF4444" : "#111827"}
          />
        </TouchableOpacity>

        {!!item?.status && (
          <View style={styles.statusPill}>
            <Text style={styles.statusText} numberOfLines={1}>
              {item.status}
            </Text>
          </View>
        )}
      </View>

      {/* INFO area (có padding riêng) */}
      <View style={styles.info}>
        {!!brand && (
          <Text style={styles.brand} numberOfLines={1}>
            {brand}
          </Text>
        )}

        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.name}>
          {item?.name}
        </Text>

        <View style={styles.row}>
          <Text style={styles.price} numberOfLines={1}>
            {formatVND(item?.price || 0)}
          </Text>

          <View style={styles.dots}>
            {(item?.color || []).slice(0, 3).map((c, idx) => (
              <View
                key={`${c}-${idx}`}
                style={[styles.dot, { backgroundColor: String(c).toLowerCase() }]}
              />
            ))}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const IMAGE_H = 140;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden", // ✅ để ảnh “dính” bo góc như Shopee
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 8,
  },

  // media full-bleed
  media: { position: "relative" },
  image: { width: "100%", height: IMAGE_H },

  badge: {
    position: "absolute",
    left: 8,
    top: 8,
    zIndex: 3,
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { color: "white", fontWeight: "800", fontSize: 11 },

  favBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  statusPill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    zIndex: 3,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "80%",
  },
  statusText: { fontSize: 11, fontWeight: "700", color: "#111827" },

  // info area
  info: { padding: 10, paddingTop: 8 },

  brand: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  name: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 16,
    minHeight: 32, // 2 lines
  },

  row: {
    marginTop: 8,
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  price: {
    fontSize: 14,
    fontWeight: "900",
    color: "green",
    flex: 1,
    marginRight: 8,
  },

  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
