import React from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFavoriteStore } from "../store/favoriteStore";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v) + "đ";

export default function ProductCard({ item, onPress }) {
  const toggleFav = useFavoriteStore((s) => s.toggle);

  // ✅ subscribe vào ids -> tự re-render khi ids đổi
  const fav = useFavoriteStore((s) => s.ids.includes(item?.id));

  const handleFavPress = () => {
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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        {!!item.discountPct && (
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

        <Image source={{ uri: item.image }} style={styles.image} />

        {!!item.status && (
          <View style={styles.statusPill}>
            <Text style={styles.statusText} numberOfLines={1}>
              {item.status}
            </Text>
          </View>
        )}
      </View>

      <Text numberOfLines={2} style={styles.name}>
        {item.name}
      </Text>

      <View style={styles.row}>
        <Text style={styles.price} numberOfLines={1}>
          {formatVND(item.price)}
        </Text>

        <View style={styles.dots}>
          {(item.color || []).slice(0, 3).map((c, idx) => (
            <View key={`${c}-${idx}`} style={[styles.dot, { backgroundColor: String(c).toLowerCase() }]} />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}


const IMAGE_H = 110;
const NAME_LINES = 2;
const NAME_LINE_H = 16;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    minHeight: IMAGE_H + 10 + NAME_LINES * NAME_LINE_H + 10 + 20 + 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 5,
  },

  imageWrap: { borderRadius: 14, overflow: "hidden", position: "relative" },
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

  name: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#111827",
    lineHeight: NAME_LINE_H,
    minHeight: NAME_LINES * NAME_LINE_H,
  },

  row: {
    marginTop: 6,
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
