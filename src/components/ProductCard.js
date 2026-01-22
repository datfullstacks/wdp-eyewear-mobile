import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v) + "đ";

export default function ProductCard({ item, onPress }) {
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {!!item.discountPct && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>-{item.discountPct}%</Text>
          </View>
        )}

        <Image source={{ uri: item.image }} style={styles.image} />

        {!!item.status && (
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        )}
      </View>

      <Text numberOfLines={2} style={styles.name}>
        {item.name}
      </Text>

      <View style={styles.row}>
        <Text style={styles.price}>{formatVND(item.price)}</Text>

        {/* Dots hoặc icon palette (tuỳ bạn) */}
        <View style={styles.dots}>
          {(item.color || []).slice(0, 3).map((c, idx) => (
            <View key={`${c}-${idx}`} style={[styles.dot, { backgroundColor: String(c).toLowerCase() }]} />
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.btn} activeOpacity={0.85} onPress={onPress}>
        <Text style={styles.btnText}>Xem</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
  },
  imageWrap: { borderRadius: 14, overflow: "hidden", position: "relative" },
  image: { width: "100%", height: 110 },

  badge: {
    position: "absolute",
    left: 8,
    top: 8,
    zIndex: 2,
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { color: "white", fontWeight: "800", fontSize: 11 },

  statusPill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: "700", color: "#111827" },

  name: { marginTop: 8, fontSize: 12.5, fontWeight: "700", color: "#111827" },
  row: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: { fontSize: 14, fontWeight: "900", color: "#111827" },

  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  btn: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnText: { color: "white", fontWeight: "800" },
});
