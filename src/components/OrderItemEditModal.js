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
import {
  buildLensPrescriptionPayload,
  inferLensPrescriptionMethod,
  normalizeLensPrescriptionDraft,
  summarizeLensPrescription,
  validateLensPrescriptionDraft,
} from "../services/lensPrescriptionService";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v || 0) + "đ";

const LENS_METHOD_ITEMS = [
  { key: "manual", label: "Nhập thông số" },
  { key: "upload", label: "Tải ảnh đơn" },
];

function formatDateTime(v) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function computeEditWindow(orderCreatedAt) {
  if (!orderCreatedAt) return { canEdit: false, reason: "Không có thông tin thời gian đơn hàng." };

  const created = new Date(orderCreatedAt);
  if (Number.isNaN(created.getTime())) return { canEdit: false, reason: "Ngày tạo đơn không hợp lệ." };

  const deadline = new Date(created.getTime() + 12 * 60 * 60 * 1000);
  const now = new Date();
  const dayOfWeek = created.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      canEdit: false,
      deadline,
      reason: `Đơn hàng tạo vào ${dayOfWeek === 6 ? "Thứ 7" : "Chủ nhật"} nên không thể chỉnh sửa.`,
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

function isFrameLikeProductType(productType) {
  return productType === "FRAME" || productType === "SUNGLASSES";
}

function buildVariantText(colorName, size) {
  if (colorName && size) return `Màu: ${colorName}, Size: ${size}`;
  if (colorName) return `Màu: ${colorName}`;
  if (size) return `Size: ${size}`;
  return null;
}

function MethodSegmented({ value, onChange }) {
  return (
    <View style={styles.segmented}>
      {LENS_METHOD_ITEMS.map((item) => {
        const active = item.key === value;
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.88}
            onPress={() => onChange(item.key)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RxField({ label, value, onChangeText, error }) {
  return (
    <View style={styles.rxCell}>
      <Text style={styles.rxLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="0.00"
        placeholderTextColor="#9CA3AF"
        keyboardType="numeric"
        style={[styles.rxInput, error && styles.rxInputError]}
      />
      {error ? <Text style={styles.rxErrorText}>{error}</Text> : null}
    </View>
  );
}

function LensEditForm({
  item,
  lensMethod,
  setLensMethod,
  lensDraft,
  setLensDraft,
  pickRxPhoto,
  colors,
  colorId,
  setColorId,
}) {
  const validation = useMemo(
    () =>
      validateLensPrescriptionDraft({
        method: lensMethod,
        draft: lensDraft,
        product: item?.product,
      }),
    [item?.product, lensDraft, lensMethod]
  );
  const summary = useMemo(
    () =>
      summarizeLensPrescription(
        buildLensPrescriptionPayload({
          method: lensMethod,
          draft: lensDraft,
        })
      ),
    [lensDraft, lensMethod]
  );

  const updateEye = (eyeKey, field, value) => {
    setLensDraft((prev) => ({
      ...prev,
      [eyeKey]: {
        ...(prev?.[eyeKey] || {}),
        [field]: value,
      },
    }));
  };

  return (
    <View style={{ gap: 16 }}>
      {Array.isArray(colors) && colors.length > 0 ? (
        <View>
          <Text style={styles.groupLabel}>Màu sắc</Text>
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <MethodSegmented value={lensMethod === "upload" ? "upload" : "manual"} onChange={setLensMethod} />

      {lensMethod === "upload" ? (
        <View>
          <Text style={styles.helperText}>Tải ảnh đơn kính để shop xử lý đơn theo toa của bạn.</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={pickRxPhoto} activeOpacity={0.88}>
            <Ionicons
              name={lensDraft?.attachmentUrls?.length ? "image" : "cloud-upload-outline"}
              size={18}
              color="#2563EB"
            />
            <Text style={styles.photoBtnText}>
              {lensDraft?.attachmentUrls?.length ? "Đổi ảnh đơn kính" : "Tải ảnh đơn kính"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.groupLabel}>Mắt phải (OD)</Text>
          <View style={styles.rxRow}>
            <RxField
              label="SPH"
              value={lensDraft?.rightEye?.sphere}
              onChangeText={(text) => updateEye("rightEye", "sphere", text)}
              error={validation.fieldErrors["rightEye.sphere"]}
            />
            <RxField
              label="CYL"
              value={lensDraft?.rightEye?.cyl}
              onChangeText={(text) => updateEye("rightEye", "cyl", text)}
              error={validation.fieldErrors["rightEye.cyl"]}
            />
            <RxField
              label="AXIS"
              value={lensDraft?.rightEye?.axis}
              onChangeText={(text) => updateEye("rightEye", "axis", text)}
              error={validation.fieldErrors["rightEye.axis"]}
            />
            <RxField
              label="ADD"
              value={lensDraft?.rightEye?.add}
              onChangeText={(text) => updateEye("rightEye", "add", text)}
              error={validation.fieldErrors["rightEye.add"]}
            />
          </View>

          <Text style={styles.groupLabel}>Mắt trái (OS)</Text>
          <View style={styles.rxRow}>
            <RxField
              label="SPH"
              value={lensDraft?.leftEye?.sphere}
              onChangeText={(text) => updateEye("leftEye", "sphere", text)}
              error={validation.fieldErrors["leftEye.sphere"]}
            />
            <RxField
              label="CYL"
              value={lensDraft?.leftEye?.cyl}
              onChangeText={(text) => updateEye("leftEye", "cyl", text)}
              error={validation.fieldErrors["leftEye.cyl"]}
            />
            <RxField
              label="AXIS"
              value={lensDraft?.leftEye?.axis}
              onChangeText={(text) => updateEye("leftEye", "axis", text)}
              error={validation.fieldErrors["leftEye.axis"]}
            />
            <RxField
              label="ADD"
              value={lensDraft?.leftEye?.add}
              onChangeText={(text) => updateEye("leftEye", "add", text)}
              error={validation.fieldErrors["leftEye.add"]}
            />
          </View>

          <View style={styles.rxRow}>
            <RxField
              label="PD"
              value={lensDraft?.pd}
              onChangeText={(text) =>
                setLensDraft((prev) => ({
                  ...prev,
                  pd: text,
                }))
              }
              error={validation.fieldErrors.pd}
            />
          </View>
        </>
      )}

      <TextInput
        value={lensDraft?.note}
        onChangeText={(text) =>
          setLensDraft((prev) => ({
            ...prev,
            note: text,
          }))
        }
        placeholder="Ghi chú thêm cho đơn kính..."
        placeholderTextColor="#9CA3AF"
        style={styles.noteInput}
        multiline
      />

      {summary?.lines?.length ? (
        <View style={styles.summaryBox}>
          {summary.lines.map((line) => (
            <Text key={line} style={styles.summaryText}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FrameEditForm({ colors, sizes, colorId, setColorId, size, setSize }) {
  return (
    <View style={{ gap: 16 }}>
      {colors.length > 0 ? (
        <View>
          <Text style={styles.groupLabel}>Màu sắc</Text>
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {sizes.length > 0 ? (
        <View>
          <Text style={styles.groupLabel}>Kích thước</Text>
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
                  <Text style={[styles.sizeText, active && styles.sizeTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
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
  const productType = item?.productType;
  const requiresLensRxFlow = Boolean(item?.requiresLensRxFlow || productType === "LENS");
  const iconName =
    requiresLensRxFlow
      ? "eye-outline"
      : isFrameLikeProductType(productType)
        ? "glasses-outline"
        : "cube-outline";

  const { canEdit, deadline, reason } = useMemo(
    () => computeEditWindow(orderCreatedAt),
    [orderCreatedAt]
  );
  const [remaining, setRemaining] = useState(() => remainingTime(deadline));
  const [lensMethod, setLensMethod] = useState("manual");
  const [lensDraft, setLensDraft] = useState(() => normalizeLensPrescriptionDraft());
  const [colorId, setColorId] = useState(null);
  const [size, setSize] = useState(null);

  const colors = useMemo(() => (item?.productColors || []).filter(Boolean), [item]);
  const sizes = useMemo(() => (item?.productSizes || []).filter(Boolean), [item]);

  useEffect(() => {
    if (!canEdit || !deadline) return;
    const timer = setInterval(() => setRemaining(remainingTime(deadline)), 1000);
    return () => clearInterval(timer);
  }, [canEdit, deadline]);

  useEffect(() => {
    if (!visible || !item) return;

    setColorId(item?.variant?.colorId || colors?.[0]?.id || null);

    if (requiresLensRxFlow) {
      setLensMethod(
        inferLensPrescriptionMethod(item?.customization?.prescription || item?.prescriptionDraft || {})
      );
      setLensDraft(
        normalizeLensPrescriptionDraft(
          item?.customization?.prescription || item?.prescriptionDraft || {}
        )
      );
      setSize(null);
      return;
    }

    setSize(item?.variant?.size || sizes?.[0] || null);
  }, [visible, item, colors, sizes, requiresLensRxFlow]);

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
      const asset = res.assets?.[0];
      if (asset?.uri) {
        setLensDraft((prev) => ({
          ...prev,
          attachmentUrls: [asset.uri],
        }));
      }
    }
  }, []);

  const handleSave = () => {
    if (!canEdit || !item) return;

    const colorObj = colors.find((c) => c.id === colorId);
    const colorName = colorObj?.name || colorObj?.label || null;

    if (requiresLensRxFlow) {
      const validation = validateLensPrescriptionDraft({
        method: lensMethod,
        draft: lensDraft,
        product: item?.product,
      });
      if (!validation.valid) {
        Alert.alert("Thiếu thông số", validation.errors[0] || "Vui lòng kiểm tra lại đơn kính.");
        return;
      }

      onSave?.({
        variant: { colorId: colorId || null, colorName, size: null },
        variantText: buildVariantText(colorName, null),
        prescriptionMethod: lensMethod,
        prescriptionDraft: lensDraft,
        customization: {
          ...(item?.customization || {}),
          selectedColor: colorName || colorId || "",
          selectedSize: "",
          note: lensDraft?.note || "",
          prescription: buildLensPrescriptionPayload({
            method: lensMethod,
            draft: lensDraft,
          }),
        },
      });
      return;
    }

    onSave?.({
      variant: { colorId, colorName, size },
      variantText: buildVariantText(colorName, size),
      customization: {
        ...(item?.customization || {}),
        selectedColor: colorName || colorId || "",
        selectedSize: size || "",
      },
    });
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
              <Text style={styles.sheetSubtitle}>Chính sách đổi trong 12 giờ (T2-T6)</Text>
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
              <Ionicons name={iconName} size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productTypeText}>{item.displayLabel || productType || "Sản phẩm"}</Text>
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
              {requiresLensRxFlow ? (
                <LensEditForm
                  item={item}
                  lensMethod={lensMethod}
                  setLensMethod={setLensMethod}
                  lensDraft={lensDraft}
                  setLensDraft={setLensDraft}
                  pickRxPhoto={pickRxPhoto}
                  colors={colors}
                  colorId={colorId}
                  setColorId={setColorId}
                />
              ) : (
                <FrameEditForm
                  colors={colors}
                  sizes={sizes}
                  colorId={colorId}
                  setColorId={setColorId}
                  size={size}
                  setSize={setSize}
                />
              )}
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
            {canEdit ? (
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleSave}
                activeOpacity={0.9}
                disabled={isSaving}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.saveText}>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 32,
  },
  handleWrap: { alignItems: "center", paddingTop: 10 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sheetSubtitle: { fontSize: 11.5, fontWeight: "700", color: "#6B7280", marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  windowBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  windowBannerOk: { backgroundColor: "#ECFDF5" },
  windowBannerNo: { backgroundColor: "#FFF7ED" },
  windowBannerTextOk: { fontSize: 12, fontWeight: "700", color: "#15803D" },
  windowDeadlineText: { marginTop: 3, fontSize: 11.5, fontWeight: "700", color: "#047857" },
  windowBannerTextNo: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  productRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  productIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  productName: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  productTypeText: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  productMeta: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#374151" },
  formScroll: { maxHeight: 460 },
  formContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  groupLabel: { fontSize: 12.5, fontWeight: "900", color: "#111827" },
  helperText: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  segmentItem: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: "#FFFFFF" },
  segmentText: { fontSize: 12, fontWeight: "900", color: "#6B7280" },
  segmentTextActive: { color: "#111827" },
  rxRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  rxCell: { flex: 1 },
  rxLabel: { fontSize: 11.5, fontWeight: "900", color: "#6B7280", marginBottom: 6 },
  rxInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    fontSize: 12.5,
    fontWeight: "800",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  rxInputError: { borderColor: "#DC2626" },
  rxErrorText: { marginTop: 6, fontSize: 11, fontWeight: "700", color: "#DC2626" },
  noteInput: {
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  photoBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  photoBtnText: { color: "#2563EB", fontWeight: "900" },
  summaryBox: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  summaryText: { fontSize: 12, fontWeight: "700", color: "#4B5563" },
  colorRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 10 },
  colorDotWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotWrapActive: { borderColor: "#111827", borderWidth: 2 },
  colorDot: { width: 18, height: 18, borderRadius: 9 },
  sizeRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  sizePill: {
    width: 46,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  sizePillActive: { backgroundColor: "#111827" },
  sizeText: { fontWeight: "900", color: "#111827" },
  sizeTextActive: { color: "#FFFFFF" },
  lockedView: { paddingHorizontal: 16, paddingVertical: 28, alignItems: "center" },
  lockedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedTitle: { marginTop: 12, fontSize: 14, fontWeight: "900", color: "#111827" },
  lockedDesc: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 13, fontWeight: "900", color: "#374151" },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: "#FFFFFF", fontWeight: "900" },
});
