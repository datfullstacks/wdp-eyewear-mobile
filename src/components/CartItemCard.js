// CartItemCard.js 
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "../store/cartStore";
import CartItemEditModal from "./CartItemEditModal";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v || 0) + "đ";
const ORDER_TYPE_LABEL = { READY: "Nhận thông số", PREORDER: "Đặt trước", CUSTOM: "Làm theo đơn" };
const PREORDER_PAY_RATE = 0.3;

function isRxFilled(rxOD, rxOS) {
  return Boolean(rxOD?.CYL) && Boolean(rxOD?.AXIS) && Boolean(rxOS?.CYL) && Boolean(rxOS?.AXIS);
}
function isCartItemComplete(ci) {
  if (ci.product?.type !== "LENS") return true;
  const hasRx = isRxFilled(ci.rxOD, ci.rxOS);
  const hasPhoto = Boolean(ci.rxPhotoAssetId || ci.rxPhoto?.uri);
  if (ci.orderType === "READY") return hasRx;
  if (ci.orderType === "CUSTOM") return hasPhoto;
  if (ci.orderType === "PREORDER") return hasRx || hasPhoto;
  return false;
}
function calcLineTotal(ci) {
  const u = ci.product?.price ?? 0;
  return u * (ci.qty || 0) * (ci?.isPreorder ? PREORDER_PAY_RATE : 1);
}
function calcLineTotalFull(ci) {
  return (ci.product?.price ?? 0) * (ci.qty || 0);
}

export function CartItemCard({ ci, onDec, onInc, onRemove, cartType }) {
  const setFlags = useCartStore((s) => s.setFlags);
  const [editingItem, setEditingItem] = useState(null);

  const p = ci.product;
  const unitPrice = p?.price ?? p?.pricing?.salePrice ?? p?.pricing?.basePrice ?? 0;
  const complete = isCartItemComplete(ci);
  const isOut = (p?.totalStock ?? 1) <= 0 && !p?.preOrder?.enabled;

  const lensStatus =
    p?.type !== "LENS" ? null
    : ci.orderType === "READY"
      ? isRxFilled(ci.rxOD, ci.rxOS) ? "Đã nhập Rx" : "Chưa nhập Rx"
      : Boolean(ci.rxPhotoAssetId || ci.rxPhoto?.uri) ? "Đã tải ảnh đơn kính" : "Chưa tải ảnh đơn kính";

  const payNow = calcLineTotal(ci);
  const full = calcLineTotalFull(ci);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTopRow}>
        <Image source={{ uri: p.image }} style={styles.itemImage} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          {/* Name + edit pencil */}
          <View style={styles.nameRow}>
            <Text style={[styles.itemName, { flex: 1 }]} numberOfLines={2}>{p.name}</Text>
            <TouchableOpacity
              style={[styles.editBtn, isOut && styles.editBtnDisabled]}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                if (isOut) {
                  Alert.alert("Hết hàng", "Sản phẩm này đã hết hàng, không thể chỉnh sửa.");
                  return;
                }
                setEditingItem(ci);
              }}
            >
              <Ionicons name="pencil" size={13} color={isOut ? "#D1D5DB" : "#2563EB"} />
            </TouchableOpacity>
          </View>

          {ci.variantText ? <Text style={styles.variantText}>{ci.variantText}</Text> : null}

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{ORDER_TYPE_LABEL[ci.orderType] || "-"}</Text>
            </View>
            {ci.isPreorder ? (
              <>
                <View style={[styles.pill, { backgroundColor: "#FFF7ED" }]}>
                  <Text style={[styles.pillText, { color: "#B45309" }]}>Cọc 30%</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: "#E8F5E9" }]}>
                  <Text style={[styles.pillText, { color: "green" }]}>Đặt trước</Text>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceRed}>{formatVND(unitPrice)}</Text>
            {p.originalPrice ? <Text style={styles.priceOld}>{formatVND(p.originalPrice)}</Text> : null}
          </View>

          {ci.isPreorder ? (
            <Text style={[styles.variantText, { marginTop: 6, color: "#B45309" }]}>
              Thanh toán hôm nay: {formatVND(payNow)} • Tổng: {formatVND(full)}
            </Text>
          ) : null}

          {p?.type === "LENS" ? (
            <Text style={[styles.variantText, { marginTop: 8, color: complete ? "#159947" : "#EF4444" }]}>
              {lensStatus}
            </Text>
          ) : null}

          {isOut && (
            <View style={styles.outRow}>
              <Ionicons name="alert-circle" size={12} color="#EF4444" />
              <Text style={styles.outLabel}>Hết hàng</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.qtyWrap}>
          <TouchableOpacity style={styles.qtyBtn} onPress={onDec} activeOpacity={0.85}>
            <Text style={styles.qtyBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{ci.qty || 1}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={onInc} activeOpacity={0.85}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.removeBtn} activeOpacity={0.85} onPress={onRemove}>
          <Text style={styles.removeText}>Xóa</Text>
        </TouchableOpacity>
      </View>

      <CartItemEditModal
        visible={Boolean(editingItem)}
        cartItem={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(patch) => {
          if (!editingItem) return;
          setFlags(editingItem.key, patch, cartType);
          setEditingItem(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: "#FFFFFF", borderRadius: 18, padding: 12, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  itemTopRow: { flexDirection: "row", alignItems: "flex-start" },
  itemImage: { width: 74, height: 58, borderRadius: 12, backgroundColor: "#F3F4F6" },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  itemName: { fontSize: 14, fontWeight: "900", color: "#111827" },
  editBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
  },
  editBtnDisabled: { backgroundColor: "#F3F4F6" },
  variantText: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  pillRow: { marginTop: 8, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#E9F1FF", borderRadius: 999 },
  pillText: { color: "#2563EB", fontSize: 12, fontWeight: "900" },
  priceRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  priceRed: { color: "#EF4444", fontWeight: "900", fontSize: 14 },
  priceOld: { color: "#9CA3AF", fontWeight: "800", fontSize: 12, textDecorationLine: "line-through" },
  outRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  outLabel: { fontSize: 12, fontWeight: "800", color: "#EF4444" },
  actionsRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  qtyWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#E5E7EB",
  },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 16, fontWeight: "900", color: "#111827" },
  qtyValue: { width: 18, textAlign: "center", fontWeight: "900", color: "#111827" },
  removeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#FEE2E2" },
  removeText: { fontSize: 12.5, fontWeight: "900", color: "#EF4444" },
});