// screens/CartScreen.js
import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "../store/cartStore";
import { buildCheckoutPayload, buildCheckoutItems, fetchCheckoutQuote } from "../services/checkoutService";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v || 0) + "đ";

const ORDER_TYPE_LABEL = {
  READY: "Nhận thông số",
  PREORDER: "Đặt trước",
  CUSTOM: "Làm theo đơn",
};

function isRxFilled(rxOD, rxOS) {
  const okOD = Boolean(rxOD?.CYL) && Boolean(rxOD?.AXIS);
  const okOS = Boolean(rxOS?.CYL) && Boolean(rxOS?.AXIS);
  return okOD && okOS;
}

function isCartItemComplete(ci) {
  const type = ci.product?.type;
  if (type !== "LENS") return true;

  const hasRx = isRxFilled(ci.rxOD, ci.rxOS);
  const hasPhoto = Boolean(ci.rxPhotoAssetId || ci.rxPhoto?.uri);

  if (ci.orderType === "READY") return hasRx;
  if (ci.orderType === "CUSTOM") return hasPhoto;
  if (ci.orderType === "PREORDER") return hasRx || hasPhoto;

  return false;
}
function calcLineTotal(ci) {
  const unitPrice = ci.product?.price ?? ci.product?.pricing?.salePrice ?? ci.product?.pricing?.basePrice ?? 0;
  return unitPrice * (ci.qty || 0);
}

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const items = useCartStore((s) => s.items);
  const isHydrating = useCartStore((s) => s.isHydrating);
  const hydrate = useCartStore((s) => s.hydrate);
  const setQtyStore = useCartStore((s) => s.setQty);
  const removeItemStore = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const [isQuoting, setIsQuoting] = useState(false);

  useEffect(() => {
    if (isHydrating) hydrate();
  }, [isHydrating, hydrate]);

  const canCheckout = useMemo(() => {
    if (items.length === 0) return false;
    return items.every(isCartItemComplete);
  }, [items]);

  const subtotal = useMemo(() => items.reduce((s, ci) => s + calcLineTotal(ci), 0), [items]);

  const discount = useMemo(() => Math.round(subtotal * 0.2), [subtotal]);
  const shipping = items.length > 0 ? 30000 : 0;
  const total = Math.max(0, subtotal - discount + shipping);

  const checkoutItems = useMemo(() => buildCheckoutItems(items), [items]);
  const shippingMethod = "standard";

  const setQty = (key, nextQty) => {
    setQtyStore(key, nextQty);
  };

  const removeItem = (key) => {
    Alert.alert("Xóa sản phẩm", "Bạn chắc chắn muốn xóa sản phẩm khỏi giỏ?", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => removeItemStore(key) },
    ]);
  };

  const proceedCheckout = async () => {
    if (!canCheckout || isQuoting) return;
    if (checkoutItems.length !== items.length) {
      Alert.alert(
        "Thiếu thông tin sản phẩm",
        "Một số sản phẩm trong giỏ không có ID hợp lệ. Vui lòng xóa và thêm lại sản phẩm."
      );
      return;
    }
    try {
      setIsQuoting(true);
      const payload = buildCheckoutPayload({
        items: checkoutItems,
        shippingFee: shipping,
        discountAmount: discount,
        shippingMethod,
      });

      console.log("checkout quote payload", payload);
      const quote = await fetchCheckoutQuote(payload);

      navigation.navigate("Checkout", {
        quote,
        quoteMeta: {
          shippingFee: shipping,
          discountAmount: discount,
          shippingMethod,
        },
      });
    } catch (err) {
      const data = err?.response?.data || {};
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("checkout quote error", err?.response?.status, data || err?.message);
      }
      const errors = Array.isArray(data.errors)
        ? data.errors.map((e) => e.msg).filter(Boolean).join("\n")
        : null;
      const message = errors || data.message || data.error || err?.message;
      Alert.alert("Không lấy được báo giá", message || "Vui lòng thử lại.");
    } finally {
      setIsQuoting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.85}
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Giỏ hàng</Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.85}
          onPress={() => {
            if (items.length === 0) return;
            Alert.alert("Xóa tất cả", "Bạn muốn xóa toàn bộ giỏ hàng?", [
              { text: "Hủy", style: "cancel" },
              { text: "Xóa", style: "destructive", onPress: clear },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 16 + Math.max(insets.bottom, 8) + 90 },
        ]}
      >
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cart-outline" size={44} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Giỏ hàng trống</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.goShopBtn}
              onPress={() =>
                navigation.navigate("Tabs", {
                  screen: "ProductsTab",
                  params: { screen: "Products" },
                })
              }
            >
              <Text style={styles.goShopText}>Đi mua sắm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map((ci) => (
            <CartItemCard
              key={ci.key}
              ci={ci}
              onDec={() => setQty(ci.key, (ci.qty || 1) - 1)}
              onInc={() => setQty(ci.key, (ci.qty || 1) + 1)}
              onRemove={() => removeItem(ci.key)}
            />
          ))
        )}

        {/* Summary */}
        {items.length > 0 ? (
          <>
            <View style={styles.summaryCard}>
              {!canCheckout ? (
                <View style={styles.warnBar}>
                  <View style={styles.warnIconWrap}>
                    <Ionicons name="warning" size={16} color="#B45309" />
                  </View>
                  <Text style={styles.warnText}>
                    Vui lòng hoàn thành thông tin tròng (nhập Rx hoặc tải ảnh đơn kính) trước khi thanh toán
                  </Text>
                </View>
              ) : null}

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Tạm tính</Text>
                <Text style={styles.sumValue}>{formatVND(subtotal)}</Text>
              </View>

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Giảm giá</Text>
                <Text style={styles.sumValue}>-{formatVND(discount)}</Text>
              </View>

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Phí vận chuyển</Text>
                <Text style={styles.sumValue}>{formatVND(shipping)}</Text>
              </View>

              <View style={styles.sumDivider} />

              <View style={styles.sumRow}>
                <Text style={styles.sumTotalLabel}>Tổng cộng</Text>
                <Text style={styles.sumTotalValue}>{formatVND(total)}</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!canCheckout || isQuoting}
              style={[styles.checkoutBtn, (!canCheckout || isQuoting) && styles.checkoutBtnDisabled]}
              onPress={proceedCheckout}
            >
              <Text style={[styles.checkoutText, (!canCheckout || isQuoting) && styles.checkoutTextDisabled]}>
                Tiến hành thanh toán
              </Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation?.navigate?.("ProductsTab")}>
              <Text style={styles.continueText}>Tiếp tục mua sắm</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CartItemCard({ ci, onDec, onInc, onRemove }) {
  const p = ci.product;
  const unitPrice = p?.price ?? p?.pricing?.salePrice ?? p?.pricing?.basePrice ?? 0;

  const complete = isCartItemComplete(ci);

  const lensStatus =
    p?.type !== "LENS"
      ? null
      : ci.orderType === "READY"
        ? isRxFilled(ci.rxOD, ci.rxOS)
          ? "Đã nhập Rx"
          : "Chưa nhập Rx"
        : Boolean(ci.rxPhotoAssetId || ci.rxPhoto?.uri)
          ? "Đã tải ảnh đơn kính"
          : "Chưa tải ảnh đơn kính";

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTopRow}>
        <Image source={{ uri: p.image }} style={styles.itemImage} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.itemName} numberOfLines={2}>
            {p.name}
          </Text>

          {ci.variantText ? <Text style={styles.variantText}>{ci.variantText}</Text> : null}

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{ORDER_TYPE_LABEL[ci.orderType] || "—"}</Text>
            </View>
            {/* ✅ NEW: show preorder tag */}
            {ci.isPreorder ? (
              <View style={[styles.pill, { backgroundColor: "#FFF7ED" }]}>
                <Text style={[styles.pillText, { color: "#B45309" }]}>Đặt trước</Text>
              </View>
            ) : null}
            
            {p?.type === "LENS" && ci?.lensMeta?.buyingLensOnly ? (
              <View style={[styles.pill, { backgroundColor: "#FFF7ED" }]}>
                <Text style={[styles.pillText, { color: "#B45309" }]}>Mua tròng riêng</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceRed}>{formatVND(unitPrice)}</Text>
            {p.originalPrice ? <Text style={styles.priceOld}>{formatVND(p.originalPrice)}</Text> : null}
          </View>

          {p?.type === "LENS" ? (
            <Text style={[styles.variantText, { marginTop: 8, color: complete ? "#159947" : "#EF4444" }]}>
              {lensStatus}
            </Text>
          ) : null}

          {ci.orderType === "READY" && ci.readyNote ? (
            <Text style={[styles.variantText, { marginTop: 6 }]}>Ghi chú: {ci.readyNote}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.configActionsRow}>
        <View style={styles.qtyWrap}>
          <TouchableOpacity style={styles.qtyBtn} onPress={onDec} activeOpacity={0.85}>
            <Text style={styles.qtyBtnText}>-</Text>
          </TouchableOpacity>

          <Text style={styles.qtyValue}>{ci.qty || 1}</Text>

          <TouchableOpacity style={styles.qtyBtn} onPress={onInc} activeOpacity={0.85}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightBtns}>
          <TouchableOpacity style={styles.removeBtn} activeOpacity={0.85} onPress={onRemove}>
            <Text style={styles.removeText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },

  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  emptyBox: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "#fff",
    borderRadius: 18,
  },
  emptyTitle: { marginTop: 10, fontSize: 14, fontWeight: "900", color: "#111827" },
  goShopBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },
  goShopText: { color: "#fff", fontWeight: "900" },

  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  itemTopRow: { flexDirection: "row", alignItems: "flex-start" },
  itemImage: { width: 74, height: 58, borderRadius: 12, backgroundColor: "#F3F4F6" },

  itemName: { fontSize: 14, fontWeight: "900", color: "#111827" },
  variantText: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },

  pillRow: { marginTop: 8, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#E9F1FF",
    borderRadius: 999,
  },
  pillText: { color: "#2563EB", fontSize: 12, fontWeight: "900" },

  priceRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  priceRed: { color: "#EF4444", fontWeight: "900", fontSize: 14 },
  priceOld: {
    color: "#9CA3AF",
    fontWeight: "800",
    fontSize: 12,
    textDecorationLine: "line-through",
  },

  configActionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 16, fontWeight: "900", color: "#111827" },
  qtyValue: { width: 18, textAlign: "center", fontWeight: "900", color: "#111827" },

  rightBtns: { flexDirection: "row", alignItems: "center", gap: 10 },
  removeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  removeText: { fontSize: 12.5, fontWeight: "900", color: "#EF4444" },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 4,
  },
  warnBar: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  warnIconWrap: { width: 22, alignItems: "center" },
  warnText: { flex: 1, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },

  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  sumLabel: { fontSize: 13, fontWeight: "800", color: "#6B7280" },
  sumValue: { fontSize: 13, fontWeight: "900", color: "#111827" },
  sumDivider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 6 },

  sumTotalLabel: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  sumTotalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },

  checkoutBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBtnDisabled: { backgroundColor: "#E5E7EB" },
  checkoutText: { color: "#FFFFFF", fontWeight: "900" },
  checkoutTextDisabled: { color: "#9CA3AF" },

  continueText: {
    marginTop: 12,
    textAlign: "center",
    color: "#2563EB",
    fontWeight: "900",
  },
});