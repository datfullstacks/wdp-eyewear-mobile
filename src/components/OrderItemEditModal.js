// components/OrderItemEditModal.js
/**
 * OrderItemEditModal
 *
 * Rules:
 *  - Editable within 12h of order creation (Mon–Fri only, not Sat/Sun)
 *  - If past 12h OR it's weekend → read-only with a clear message
 *  - Lens: edit CYL/AXIS or swap rx photo + ✅ edit color (NO size)
 *  - Frame: edit size & color
 *  - onSave(patch) is handled by parent screen (API call)
 */
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v || 0) + "đ";
const formatDateTime = (v) => {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("vi-VN", { hour12: false });
};

function isRxFilled(rxOD, rxOS) {
  return Boolean(rxOD?.CYL) && Boolean(rxOD?.AXIS) && Boolean(rxOS?.CYL) && Boolean(rxOS?.AXIS);
}

function computeEditWindow(orderCreatedAt) {
  if (!orderCreatedAt) return { canEdit: false, reason: "Không có thông tin thời gian đơn hàng." };

  const created = new Date(orderCreatedAt);
  if (Number.isNaN(created.getTime())) return { canEdit: false, reason: "Ngày tạo đơn không hợp lệ." };

  const deadline = new Date(created.getTime() + 12 * 60 * 60 * 1000); // +12h
  const now = new Date();
  const dayOfWeek = created.getDay(); // 0=Sun, 6=Sat

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      canEdit: false,
      deadline,
      reason: `Đơn hàng tạo vào ${dayOfWeek === 6 ? "Thứ 7" : "Chủ nhật"} nên không thể chỉnh sửa (ngoài giờ làm việc).`,
    };
  }

  if (now > deadline) {
    return {
      canEdit: false,
      deadline,
      reason: `Đã quá 12 giờ kể từ lúc đặt hàng (hạn chỉnh sửa: ${formatDateTime(deadline)}).`,
    };
  }

  return { canEdit: true, deadline };
}

function remainingTime(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Đã hết hạn";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}g ${m}p ${s}s`;
}

export default function OrderItemEditModal({
  visible,
  orderItem,
  orderCreatedAt,
  onClose,
  onSave,
  isSaving = false,
}) {
  const item = orderItem;
  const productType = item?.productType; // "LENS" | "FRAME"

  const { canEdit, deadline, reason } = useMemo(
    () => computeEditWindow(orderCreatedAt),
    [orderCreatedAt]
  );

  const [remaining, setRemaining] = useState(() => remainingTime(deadline));

  useEffect(() => {
    if (!canEdit || !deadline) return;
    const timer = setInterval(() => setRemaining(remainingTime(deadline)), 1000);
    return () => clearInterval(timer);
  }, [canEdit, deadline]);

  // options from item
  const colors = useMemo(() => (item?.productColors || []).filter(Boolean), [item]);
  const sizes = useMemo(() => (item?.productSizes || []).filter(Boolean), [item]);

  /* ── LENS state ──────────────────────────────── */
  const [rxOD, setRxOD] = useState({ CYL: "", AXIS: "" });
  const [rxOS, setRxOS] = useState({ CYL: "", AXIS: "" });
  const [rxPhoto, setRxPhoto] = useState(null);

  /* ── Variant state (FRAME + LENS color) ──────── */
  const [colorId, setColorId] = useState(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    if (!visible || !item) return;

    // ✅ init color for both lens + frame if colors exist
    setColorId(item.variant?.colorId || colors?.[0]?.id || null);

    if (productType === "LENS") {
      setRxOD(item.rxOD || { CYL: "", AXIS: "" });
      setRxOS(item.rxOS || { CYL: "", AXIS: "" });
      setRxPhoto(item.rxPhoto || null);

      // ✅ Lens: no size editing
      setSize(null);
    } else {
      setSize(item.variant?.size || sizes?.[0] || null);
    }
  }, [visible, item, productType, colors, sizes]);

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
    if (!canEdit) return;

    const colorObj = colors?.find((c) => c.id === colorId);
    const colorName = colorObj?.name || "—";
    let patchToSave = null;

    if (productType === "LENS") {
      const ot = item?.orderType;

      if (ot === "READY" && !isRxFilled(rxOD, rxOS)) {
        Alert.alert("Thiếu thông số", "Vui lòng nhập đầy đủ CYL và AXIS cho cả hai mắt.");
        return;
      }
      if (ot === "CUSTOM" && !rxPhoto?.uri) {
        Alert.alert("Thiếu ảnh", "Vui lòng tải ảnh đơn kính.");
        return;
      }

      // ✅ Save includes color (NO size)
      const patch = {
        rxOD,
        rxOS,
        rxPhoto,
      };

      if (colors.length) {
        patch.variant = { colorId: colorId || null, colorName, size: null };
        patch.variantText = `Màu: ${colorName}`;
      }
      patchToSave = patch;
    } else {
      patchToSave = {
        variant: { colorId, colorName, size },
        variantText: `Màu: ${colorName}, Size: ${size || "—"}`,
      };
    }

    onSave?.(patchToSave);
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.titleRow}>
            <View>
              <Text style={styles.sheetTitle}>Chỉnh sửa sản phẩm</Text>
              <Text style={styles.sheetSubtitle}>Chính sách đổi trong 12 giờ (T2–T6)</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={[styles.windowBanner, canEdit ? styles.windowBannerOk : styles.windowBannerNo]}>
            <Ionicons
              name={canEdit ? "timer-outline" : "lock-closed-outline"}
              size={15}
              color={canEdit ? "#15803D" : "#B45309"}
            />
            {canEdit ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.windowBannerTextOk}>
                  Còn thời gian chỉnh sửa: <Text style={{ fontWeight: "900" }}>{remaining}</Text>
                </Text>
                <Text style={styles.windowDeadlineText}>Hạn chỉnh sửa: {formatDateTime(deadline)}</Text>
              </View>
            ) : (
              <Text style={[styles.windowBannerTextNo, { flex: 1 }]}>{reason}</Text>
            )}
          </View>

          <View style={styles.productRow}>
            <View style={styles.productIconWrap}>
              <Ionicons
                name={productType === "LENS" ? "eye-outline" : "glasses-outline"}
                size={22}
                color="#2563EB"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productMeta}>
                {item.qty} x {formatVND(item.price)} {item.preorder ? "· Đặt trước" : ""}
              </Text>
            </View>
          </View>

          {canEdit ? (
            <ScrollView
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
            >
              {productType === "LENS" ? (
                <LensEditForm
                  item={item}
                  rxOD={rxOD}
                  rxOS={rxOS}
                  setRxOD={setRxOD}
                  setRxOS={setRxOS}
                  rxPhoto={rxPhoto}
                  pickRxPhoto={pickRxPhoto}
                  colors={colors}
                  colorId={colorId}
                  setColorId={setColorId}
                />
              ) : (
                <FrameEditForm
                  item={item}
                  colors={colors}
                  sizes={sizes}
                  colorId={colorId}
                  setColorId={setColorId}
                  size={size}
                  setSize={setSize}
                />
              )}

              <View style={styles.apiNotice}>
                <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
                <Text style={styles.apiNoticeText}>
                  Thay đổi sẽ được cập nhật lên hệ thống khi bạn bấm Lưu thay đổi.
                </Text>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.lockedView}>
              <View style={styles.lockedIconWrap}>
                <Ionicons name="lock-closed" size={32} color="#D1D5DB" />
              </View>
              <Text style={styles.lockedTitle}>Không thể chỉnh sửa</Text>
              <Text style={styles.lockedDesc}>{reason}</Text>
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>Đóng</Text>
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleSave}
                activeOpacity={0.9}
                disabled={isSaving}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.saveText}>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Lens sub-form ─────────────────────────────────────── */
function LensEditForm({
  item,
  rxOD,
  rxOS,
  setRxOD,
  setRxOS,
  rxPhoto,
  pickRxPhoto,
  colors,
  colorId,
  setColorId,
}) {
  const ot = item?.orderType;
  const showRx = ot === "READY" || ot === "PREORDER";
  const showPhoto = ot === "CUSTOM" || ot === "PREORDER";

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.orderTypeTag}>
        <Text style={styles.orderTypeTagText}>
          {{ READY: "Nhận thông số", CUSTOM: "Làm theo đơn", PREORDER: "Đặt trước" }[ot] || ot}
        </Text>
      </View>

      {/* ✅ Lens: edit color only (no size) */}
      {Array.isArray(colors) && colors.length > 0 && (
        <View>
          <Text style={styles.fieldGroupLabel}>Màu sắc</Text>
          <View style={styles.colorRow}>
            {colors.map((c) => {
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
                    <View style={styles.colorCheck}>
                      <Ionicons name="checkmark" size={9} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {colorId && (
            <Text style={styles.selectedHint}>
              Đã chọn: {colors.find((c) => c.id === colorId)?.name || "—"}
            </Text>
          )}
        </View>
      )}

      {showRx && (
        <>
          <View>
            <Text style={styles.fieldGroupLabel}>Mắt phải (OD)</Text>
            <View style={styles.rxRow}>
              <RxField label="CYL" value={rxOD.CYL} onChangeText={(t) => setRxOD((p) => ({ ...p, CYL: t }))} />
              <RxField label="AXIS" value={rxOD.AXIS} onChangeText={(t) => setRxOD((p) => ({ ...p, AXIS: t }))} />
            </View>
          </View>
          <View>
            <Text style={styles.fieldGroupLabel}>Mắt trái (OS)</Text>
            <View style={styles.rxRow}>
              <RxField label="CYL" value={rxOS.CYL} onChangeText={(t) => setRxOS((p) => ({ ...p, CYL: t }))} />
              <RxField label="AXIS" value={rxOS.AXIS} onChangeText={(t) => setRxOS((p) => ({ ...p, AXIS: t }))} />
            </View>
          </View>
        </>
      )}

      {showPhoto && (
        <View>
          {ot === "PREORDER" && <Text style={styles.fieldGroupLabel}>Hoặc tải ảnh đơn kính</Text>}
          <TouchableOpacity style={styles.photoBtn} onPress={pickRxPhoto} activeOpacity={0.85}>
            <Ionicons name={rxPhoto?.uri ? "image" : "cloud-upload-outline"} size={18} color="#2563EB" />
            <Text style={styles.photoBtnText}>
              {rxPhoto?.uri ? "Đổi ảnh đơn kính" : "Tải ảnh đơn kính"}
            </Text>
          </TouchableOpacity>
          {rxPhoto?.uri && (
            <View style={styles.photoOkRow}>
              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
              <Text style={styles.photoOkText}>Đã chọn ảnh mới</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ── Frame sub-form ────────────────────────────────────── */
function FrameEditForm({ colors, sizes, colorId, setColorId, size, setSize }) {
  return (
    <View style={{ gap: 16 }}>
      {colors.length > 0 && (
        <View>
          <Text style={styles.fieldGroupLabel}>Màu sắc</Text>
          <View style={styles.colorRow}>
            {colors.map((c) => {
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
                    <View style={styles.colorCheck}>
                      <Ionicons name="checkmark" size={9} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {colorId && (
            <Text style={styles.selectedHint}>
              Đã chọn: {colors.find((c) => c.id === colorId)?.name || "—"}
            </Text>
          )}
        </View>
      )}

      {sizes.length > 0 && (
        <View>
          <Text style={styles.fieldGroupLabel}>Kích thước</Text>
          <View style={styles.sizeRow}>
            {sizes.map((s) => {
              const active = s === size;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSize(s)}
                  activeOpacity={0.85}
                  style={[styles.sizePill, active && styles.sizePillActive]}
                >
                  <Text style={[styles.sizeTxt, active && styles.sizeTxtActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {colors.length === 0 && sizes.length === 0 && (
        <Text style={styles.noOptsText}>
          Không có tùy chọn màu sắc hoặc kích thước cho sản phẩm này.
        </Text>
      )}
    </View>
  );
}

/* ── Atoms ─────────────────────────────────────────────── */
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

/* ── Styles (giữ nguyên style của bạn) ─────────────────── */
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", paddingBottom: 32 },
  handleWrap: { alignItems: "center", paddingTop: 10 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },

  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sheetSubtitle: { fontSize: 11.5, fontWeight: "700", color: "#6B7280", marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginTop: 2 },

  windowBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 12 },
  windowBannerOk: { backgroundColor: "#ECFDF5" },
  windowBannerNo: { backgroundColor: "#FFF7ED" },
  windowBannerTextOk: { fontSize: 12.5, fontWeight: "700", color: "#166534" },
  windowBannerTextNo: { fontSize: 12.5, fontWeight: "700", color: "#92400E", lineHeight: 18 },
  windowDeadlineText: { fontSize: 11, fontWeight: "700", color: "#6B7280", marginTop: 2 },

  productRow: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 10, padding: 12, backgroundColor: "#F6F7FB", borderRadius: 14 },
  productIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 13, fontWeight: "900", color: "#111827" },
  productMeta: { fontSize: 11.5, fontWeight: "700", color: "#6B7280", marginTop: 3 },

  formScroll: { maxHeight: 380 },
  formContent: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4, gap: 4 },

  orderTypeTag: { alignSelf: "flex-start", backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  orderTypeTagText: { fontSize: 12, fontWeight: "800", color: "#2563EB" },

  fieldGroupLabel: { fontSize: 13, fontWeight: "900", color: "#111827", marginBottom: 8 },

  rxRow: { flexDirection: "row", gap: 12 },
  rxCell: { flex: 1 },
  rxLabel: { fontSize: 11, fontWeight: "800", color: "#6B7280", marginBottom: 6 },
  rxInput: { height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", paddingHorizontal: 12, fontSize: 14, fontWeight: "800", color: "#111827", backgroundColor: "#FAFAFA" },

  photoBtn: { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: "#2563EB", borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F0F6FF" },
  photoBtnText: { fontSize: 13, fontWeight: "800", color: "#2563EB" },
  photoOkRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  photoOkText: { fontSize: 12, fontWeight: "700", color: "#15803D" },

  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorDotWrap: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center", position: "relative" },
  colorDotWrapActive: { borderColor: "#111827", borderWidth: 2.5 },
  colorDot: { width: 22, height: 22, borderRadius: 11 },
  colorCheck: { position: "absolute", bottom: -2, right: -2, width: 15, height: 15, borderRadius: 7.5, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  selectedHint: { marginTop: 6, fontSize: 11.5, fontWeight: "700", color: "#6B7280" },

  sizeRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  sizePill: { minWidth: 46, height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  sizePillActive: { backgroundColor: "#111827", borderColor: "#111827" },
  sizeTxt: { fontSize: 13, fontWeight: "900", color: "#374151" },
  sizeTxtActive: { color: "#FFFFFF" },

  noOptsText: { fontSize: 13, fontWeight: "700", color: "#9CA3AF", textAlign: "center", marginVertical: 8 },

  lockedView: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 24 },
  lockedIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  lockedTitle: { fontSize: 15, fontWeight: "900", color: "#374151", marginBottom: 6 },
  lockedDesc: { fontSize: 13, fontWeight: "700", color: "#6B7280", textAlign: "center", lineHeight: 19 },

  apiNotice: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10, padding: 10, backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  apiNoticeText: { flex: 1, fontSize: 11.5, fontWeight: "700", color: "#6B7280", lineHeight: 17 },

  footer: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  cancelBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 14, fontWeight: "900", color: "#374151" },
  saveBtn: { flex: 2, height: 46, borderRadius: 14, backgroundColor: "#2563EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
});
