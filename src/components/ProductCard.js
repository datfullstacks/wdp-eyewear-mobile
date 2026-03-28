import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { addMyFavoriteApi, removeMyFavoriteApi } from "../services/userService";
import CustomAlert from "./CustomAlert";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v) + "đ";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80";

const checkOutOfStock = (item) => {
  if (!item) return false;
  if (item.stockStatus === "OUT_OF_STOCK") return true;
  if (item.stockStatus === "out_of_stock") return true;
  if (typeof item.totalStock === "number" && item.totalStock <= 0) return true;
  if (typeof item.stock === "number" && item.stock <= 0) return true;
  if (item.isAvailable === false) return true;
  if (item.inStock === false) return true;
  if (item.preOrder?.enabled === true && typeof item.totalStock === "number" && item.totalStock <= 0) return true;
  return false;
};

export default function ProductCard({
  item,
  onPress,
  initialFav = false,
  onFavoriteChanged,
}) {
  const navigation = useNavigation();
  const token = useAuthStore((s) => s.token);
  const [fav, setFav] = useState(Boolean(initialFav));
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    actions: [],
  });

  useEffect(() => {
    setFav(Boolean(initialFav));
  }, [initialFav]);

  const openAlert = (title, message, actions = []) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      actions,
    });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({
      ...prev,
      visible: false,
    }));
  };

  const requireLogin = () => {
    openAlert("Cần đăng nhập", "Vui lòng đăng nhập để thêm yêu thích.", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng nhập", onPress: () => navigation.navigate("Login") },
    ]);
  };

  const handleFavPress = async () => {
    if (!token) return requireLogin();
    if (!item?.id) return;

    const productId = String(item.id);

    if (fav) {
      openAlert(
        "Bỏ yêu thích?",
        `Bạn muốn bỏ "${item?.name ?? "sản phẩm"}" khỏi danh sách yêu thích?`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Bỏ",
            style: "destructive",
            onPress: async () => {
              const prev = fav;
              setFav(false);
              onFavoriteChanged?.(false, item);

              try {
                await removeMyFavoriteApi(productId);
              } catch {
                setFav(prev);
                onFavoriteChanged?.(true, item);
              }
            },
          },
        ]
      );
    } else {
      const prev = fav;
      setFav(true);
      onFavoriteChanged?.(true, item);

      try {
        await addMyFavoriteApi(productId);
        openAlert(
          "Đã thêm yêu thích",
          `"${item?.name ?? "Sản phẩm"}" đã được thêm vào yêu thích.`
        );
      } catch {
        setFav(prev);
        onFavoriteChanged?.(false, item);
      }
    }
  };

  const img = item?.image || item?.posterUrl || FALLBACK_IMG;
  const brand = item?.brand ? String(item.brand) : null;
  const isOutOfStock = checkOutOfStock(item);

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
        <View style={styles.media}>
          <Image source={{ uri: img }} style={[styles.image, isOutOfStock && styles.imageDisabled]} />

          {isOutOfStock ? (
            <View style={styles.outOfStockOverlay} pointerEvents="none">
              <Text style={styles.outOfStockText}>Hết hàng</Text>
            </View>
          ) : !!item?.discountPct ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>-{item.discountPct}%</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.favBtn} activeOpacity={0.85} onPress={handleFavPress}>
            <Ionicons
              name={fav ? "heart" : "heart-outline"}
              size={18}
              color={fav ? "#EF4444" : "#111827"}
            />
          </TouchableOpacity>

          {!!item?.status && !isOutOfStock && (
            <View style={styles.statusPill}>
              <Text style={styles.statusText} numberOfLines={1}>
                {item.status}
              </Text>
            </View>
          )}

          {!!item?.canTryOn && !isOutOfStock && (
            <View style={styles.tryOnPill}>
              <Ionicons name="camera-outline" size={12} color="#FFFFFF" />
              <Text style={styles.tryOnPillText}>Thử kính</Text>
            </View>
          )}
        </View>

        <View style={[styles.info, isOutOfStock && styles.infoDisabled]}>
          {!!brand && (
            <Text style={styles.brand} numberOfLines={1}>
              {brand}
            </Text>
          )}

          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.name}>
            {item?.name}
          </Text>

          <View style={styles.row}>
            <Text style={[styles.price, isOutOfStock && styles.priceDisabled]} numberOfLines={1}>
              {formatVND(item?.price || 0)}
            </Text>

            <View style={styles.dots}>
              {(item?.color || []).slice(0, 3).map((c, idx) => (
                <View
                  key={`${c}-${idx}`}
                  style={[
                    styles.dot,
                    { backgroundColor: String(c).toLowerCase(), opacity: isOutOfStock ? 0.4 : 1 },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        actions={alertConfig.actions}
        onClose={closeAlert}
      />
    </>
  );
}

const IMAGE_H = 140;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "lightgray"
  },
  media: { position: "relative" },
  image: { width: "100%", height: IMAGE_H },
  imageDisabled: { opacity: 0.5 },

  outOfStockOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  outOfStockText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

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
    zIndex: 5,
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
  tryOnPill: {
    position: "absolute",
    right: 8,
    bottom: 8,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(17,24,39,0.88)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tryOnPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  info: { padding: 10, paddingTop: 8 },
  infoDisabled: { opacity: 0.6 },

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
    minHeight: 32,
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
  priceDisabled: { color: "#9CA3AF" },

  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
