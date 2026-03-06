// components/CartItemEditModal.js
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v || 0) + "đ";

function isRxFilled(rxOD, rxOS) {
  const okOD = Boolean(rxOD?.CYL) && Boolean(rxOD?.AXIS);
  const okOS = Boolean(rxOS?.CYL) && Boolean(rxOS?.AXIS);
  return okOD && okOS;
}

export default function CartItemEditModal({ visible, cartItem, onClose, onSave }) {
  const ci = cartItem;
  const product = ci?.product;
  const productType = product?.type; // "LENS" | "FRAME"
  const isOut = (product?.totalStock ?? 1) <= 0 && !product?.preOrder?.enabled;

  /* ── LENS state ──────────────────────────────────────── */
  const [rxOD, setRxOD] = useState({ CYL: "", AXIS: "" });
  const [rxOS, setRxOS] = useState({ CYL: "", AXIS: "" });
  const [rxPhoto, setRxPhoto] = useState(null);

  /* ── FRAME state ─────────────────────────────────────── */
  const [colorId, setColorId] = useState(null);
  const [size, setSize] = useState(null);

  /* populate from existing item when modal opens */
  useEffect(() => {
    if (!visible || !ci) return;

    if (productType === "LENS") {
      setRxOD(ci.rxOD || { CYL: "", AXIS: "" });
      setRxOS(ci.rxOS || { CYL: "", AXIS: "" });
      setRxPhoto(ci.rxPhoto || null);
    } else {
      setColorId(ci.variant?.colorId || product?.colors?.[0]?.id || null);
      setSize(ci.variant?.size || product?.sizes?.[0] || null);
    }
  }, [visible, ci]);

  const pickRxPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Thiếu quyền", "Vui lòng cấp quyền truy cập ảnh.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled) {
      const a = res.assets?.[0];
      if (a?.uri) setRxPhoto({ uri: a.uri, name: "rx.jpg", type: "image/jpeg" });
    }
  }, []);

  const handleSave = () => {
    if (isOut) {
      Alert.alert("Hết hàng", "Sản phẩm này đã hết hàng, không thể chỉnh sửa.");
      return;
    }

    if (productType === "LENS") {
      const ot = ci.orderType;
      if (ot === "READY" && !isRxFilled(rxOD, rxOS)) {
        Alert.alert("Thiếu thông số", "Vui lòng nhập đầy đủ CYL và AXIS cho cả hai mắt.");
        return;
      }
      if (ot === "CUSTOM" && !rxPhoto?.uri) {
        Alert.alert("Thiếu ảnh", "Vui lòng tải ảnh đơn kính.");
        return;
      }

      const prescriptionFilled =
        ot === "READY"
          ? isRxFilled(rxOD, rxOS)
          : ot === "CUSTOM"
          ? Boolean(rxPhoto?.uri)
          : isRxFilled(rxOD, rxOS) || Boolean(rxPhoto?.uri);

      onSave?.({ rxOD, rxOS, rxPhoto, prescriptionFilled });
    } else {
      // FRAME
      const colorObj = product?.colors?.find((c) => c.id === colorId);
      const variant = {
        colorId: colorId || null,
        colorName: colorObj?.name || colorObj?.label || "—",
        size: size || null,
      };
      const variantText = `Mau: ${colorObj?.name || "—"}, Size: ${size || "—"}`;
      onSave?.({ variant, variantText });
    }

    onClose?.();
  };

  if (!ci || !product) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandleBar} />
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle}>Chỉnh sửa sản phẩm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Product summary */}
          <View style={styles.productSummary}>
            <Image source={{ uri: product.image }} style={styles.productThumb} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.productPrice}>{formatVND(product.price)}</Text>
              {isOut && (
                <View style={styles.outOfStockPill}>
                  <Ionicons name="alert-circle" size={12} color="#EF4444" />
                  <Text style={styles.outOfStockText}>Sản phẩm đã hết hàng</Text>
                </View>
              )}
            </View>
          </View>

          {isOut ? (
            <View style={styles.disabledNotice}>
              <Ionicons name="ban-outline" size={18} color="#B45309" />
              <Text style={styles.disabledNoticeText}>
                Không thể chỉnh sửa sản phẩm đã hết hàng. Vui lòng xóa và chọn sản phẩm khác.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
            >
              {productType === "LENS" ? (
                <LensEditForm
                  ci={ci}
                  rxOD={rxOD}
                  rxOS={rxOS}
                  setRxOD={setRxOD}
                  setRxOS={setRxOS}
                  rxPhoto={rxPhoto}
                  pickRxPhoto={pickRxPhoto}
                />
              ) : (
                <FrameEditForm
                  product={product}
                  colorId={colorId}
                  setColorId={setColorId}
                  size={size}
                  setSize={setSize}
                />
              )}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isOut && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isOut}
              activeOpacity={0.9}
            >
              <Ionicons name="checkmark" size={16} color={isOut ? "#9CA3AF" : "#FFFFFF"} />
              <Text style={[styles.saveText, isOut && styles.saveTextDisabled]}>Lưu thay đổi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Sub-forms ──────────────────────────────────────────── */

function LensEditForm({ ci, rxOD, rxOS, setRxOD, setRxOS, rxPhoto, pickRxPhoto }) {
  const ot = ci?.orderType;
  const showRx = ot === "READY";
  const showPhoto = ot === "CUSTOM";
  const showBoth = ot === "PREORDER";

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.orderTypeBadge}>
        <Ionicons name="information-circle-outline" size={14} color="#2563EB" />
        <Text style={styles.orderTypeBadgeText}>
          Loại đơn:{" "}
          {{ READY: "Nhận thông số", CUSTOM: "Làm theo đơn", PREORDER: "Đặt trước" }[ot] || ot}
        </Text>
      </View>

      {(showRx || showBoth) && (
        <>
          <SectionLabel label="Mắt phải (OD)" />
          <View style={styles.rxRow}>
            <RxField
              label="CYL"
              value={rxOD.CYL}
              onChangeText={(t) => setRxOD((p) => ({ ...p, CYL: t }))}
            />
            <RxField
              label="AXIS"
              value={rxOD.AXIS}
              onChangeText={(t) => setRxOD((p) => ({ ...p, AXIS: t }))}
            />
          </View>

          <SectionLabel label="Mắt trái (OS)" />
          <View style={styles.rxRow}>
            <RxField
              label="CYL"
              value={rxOS.CYL}
              onChangeText={(t) => setRxOS((p) => ({ ...p, CYL: t }))}
            />
            <RxField
              label="AXIS"
              value={rxOS.AXIS}
              onChangeText={(t) => setRxOS((p) => ({ ...p, AXIS: t }))}
            />
          </View>
        </>
      )}

      {(showPhoto || showBoth) && (
        <>
          {showBoth && <SectionLabel label="Hoặc tải ảnh đơn kính" />}
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={pickRxPhoto}
            activeOpacity={0.85}
          >
            <Ionicons
              name={rxPhoto?.uri ? "image" : "cloud-upload-outline"}
              size={18}
              color="#2563EB"
            />
            <Text style={styles.photoBtnText}>
              {rxPhoto?.uri ? "Đổi ảnh đơn kính" : "Tải ảnh đơn kính"}
            </Text>
          </TouchableOpacity>
          {rxPhoto?.uri && (
            <View style={styles.photoPreviewRow}>
              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
              <Text style={styles.photoPreviewText}>Đã chọn ảnh</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function FrameEditForm({ product, colorId, setColorId, size, setSize }) {
  const hasColors = Array.isArray(product?.colors) && product.colors.length > 0;
  const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;

  return (
    <View style={{ gap: 16 }}>
      {hasColors && (
        <View>
          <SectionLabel label="Màu sắc" />
          <View style={styles.colorRow}>
            {product.colors.map((c) => {
              const active = c.id === colorId;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setColorId(c.id)}
                  activeOpacity={0.85}
                  style={[styles.colorDotWrap, active && styles.colorDotWrapActive]}
                >
                  <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
                  {active && (
                    <View style={styles.colorDotCheck}>
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {colorId && (
            <Text style={styles.selectedLabel}>
              Đã chọn: {product.colors.find((c) => c.id === colorId)?.name || "—"}
            </Text>
          )}
        </View>
      )}

      {hasSizes && (
        <View>
          <SectionLabel label="Kích thước" />
          <View style={styles.sizeRow}>
            {product.sizes.map((s) => {
              const active = s === size;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSize(s)}
                  activeOpacity={0.85}
                  style={[styles.sizePill, active && styles.sizePillActive]}
                >
                  <Text style={[styles.sizeText, active && styles.sizeTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {!hasColors && !hasSizes && (
        <Text style={styles.noOptionsText}>
          Sản phẩm này không có tùy chọn màu sắc hoặc kích thước.
        </Text>
      )}
    </View>
  );
}

/* ── Atoms ─────────────────────────────────────────────── */

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function RxField({ label, value, onChangeText }) {
  return (
    <View style={styles.rxCell}>
      <Text style={styles.rxLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="0.00"
        placeholderTextColor="#9CA3AF"
        keyboardType="numeric"
        style={styles.rxInput}
      />
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    paddingBottom: 32,
  },
  sheetHeader: { alignItems: "center", paddingTop: 10 },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  productSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#F6F7FB",
    borderRadius: 16,
  },
  productThumb: {
    width: 56,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  productName: { fontSize: 13, fontWeight: "900", color: "#111827", marginBottom: 4 },
  productPrice: { fontSize: 12, fontWeight: "800", color: "#EF4444" },
  outOfStockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  outOfStockText: { fontSize: 11, fontWeight: "800", color: "#EF4444" },

  disabledNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  disabledNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    lineHeight: 18,
  },

  formScroll: { maxHeight: 380 },
  formContent: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },

  orderTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  orderTypeBadgeText: { fontSize: 12.5, fontWeight: "800", color: "#2563EB" },

  sectionLabel: { fontSize: 13, fontWeight: "900", color: "#111827", marginBottom: 8 },

  rxRow: { flexDirection: "row", gap: 12 },
  rxCell: { flex: 1 },
  rxLabel: { fontSize: 11.5, fontWeight: "800", color: "#6B7280", marginBottom: 6 },
  rxInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    backgroundColor: "#FAFAFA",
  },

  photoBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F6FF",
  },
  photoBtnText: { fontSize: 13, fontWeight: "800", color: "#2563EB" },
  photoPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -6,
  },
  photoPreviewText: { fontSize: 12, fontWeight: "700", color: "#15803D" },

  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorDotWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  colorDotWrapActive: { borderColor: "#111827", borderWidth: 2.5 },
  colorDot: { width: 22, height: 22, borderRadius: 11 },
  colorDotCheck: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedLabel: { marginTop: 6, fontSize: 11.5, fontWeight: "700", color: "#6B7280" },

  sizeRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  sizePill: {
    minWidth: 46,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  sizePillActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  sizeText: { fontSize: 13, fontWeight: "900", color: "#374151" },
  sizeTextActive: { color: "#FFFFFF" },

  noOptionsText: { fontSize: 13, fontWeight: "700", color: "#9CA3AF", textAlign: "center", marginTop: 8 },

  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelText: { fontSize: 14, fontWeight: "900", color: "#374151" },
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  saveBtnDisabled: { backgroundColor: "#E5E7EB" },
  saveText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  saveTextDisabled: { color: "#9CA3AF" },
});