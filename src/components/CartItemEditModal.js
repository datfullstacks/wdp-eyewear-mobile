import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadFileApi } from "../services/uploadService";
import {
  buildLensPrescriptionPayload,
  inferLensPrescriptionMethod,
  normalizeLensPrescriptionDraft,
  summarizeLensPrescription,
  validateLensPrescriptionDraft,
} from "../services/lensPrescriptionService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const PALETTE = {
  navy: "#0c2c5c",
  bg: "#F7F8FA",
  white: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  error: "#DC2626",
};

const formatVND = (v) => `${new Intl.NumberFormat("vi-VN").format(v || 0)}đ`;

const LENS_METHOD_ITEMS = [
  { key: "manual", label: "Nhập thông số" },
  { key: "upload", label: "Tải ảnh đơn" },
];

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

export default function CartItemEditModal({ visible, cartItem, onClose, onSave }) {
  const ci = cartItem;
  const product = ci?.product || null;
  const requiresLensRxFlow = Boolean(product?.requiresLensRxFlow);
  const isOut = (product?.totalStock ?? 1) <= 0 && !product?.preOrder?.enabled;

  const [lensMethod, setLensMethod] = useState("manual");
  const [lensDraft, setLensDraft] = useState(() => normalizeLensPrescriptionDraft());
  const [colorId, setColorId] = useState(null);
  const [size, setSize] = useState(null);
  const [isUploadingRxPhoto, setIsUploadingRxPhoto] = useState(false);

  useEffect(() => {
    if (!visible || !ci || !product) return;

    const selectedColor = ci?.customization?.selectedColor;
    const matchedColor = product?.colors?.find(
      (color) =>
        String(color.id) === String(selectedColor) ||
        String(color.name || color.label || "").toLowerCase() ===
          String(selectedColor || "").toLowerCase()
    );
    setColorId(matchedColor?.id || product?.colors?.[0]?.id || null);
    setSize(ci?.customization?.selectedSize || product?.sizes?.[0] || null);

    if (requiresLensRxFlow) {
      const prescription = ci?.customization?.prescription || {};
      setLensMethod(inferLensPrescriptionMethod(prescription));
      setLensDraft(normalizeLensPrescriptionDraft(prescription));
    } else {
      setLensMethod("manual");
      setLensDraft(normalizeLensPrescriptionDraft());
    }
  }, [visible, ci, product, requiresLensRxFlow]);

  const validation = useMemo(
    () =>
      validateLensPrescriptionDraft({
        method: lensMethod,
        draft: lensDraft,
        product,
      }),
    [lensDraft, lensMethod, product]
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

  const pickRxPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Thiếu quyền", "Vui lòng cấp quyền truy cập ảnh.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    const asset = res.assets?.[0];
    if (res.canceled || !asset?.uri) return;

    try {
      setIsUploadingRxPhoto(true);
      const uploaded = await uploadFileApi(
        {
          uri: asset.uri,
          name: asset.fileName || `cart-rx-${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        },
        { folder: "lens-prescriptions" }
      );

      setLensDraft((prev) => ({
        ...prev,
        attachmentUrls: [uploaded.url],
      }));
    } catch (error) {
      Alert.alert(
        "Upload thất bại",
        error?.response?.data?.message || error?.message || "Không thể tải ảnh đơn kính lên."
      );
    } finally {
      setIsUploadingRxPhoto(false);
    }
  }, []);

  const handleSave = () => {
    if (isOut || !ci || !product) return;

    const customization = { ...(ci?.customization || {}) };
    const colorObj = product?.colors?.find((color) => color.id === colorId);
    customization.selectedColor = colorObj?.name || colorObj?.label || colorId || "";

    if (requiresLensRxFlow) {
      if (!validation.valid) {
        Alert.alert("Lỗi", validation.errors[0] || "Thông tin đơn kính chưa hợp lệ.");
        return;
      }
      customization.prescription = buildLensPrescriptionPayload({
        method: lensMethod,
        draft: lensDraft,
      });
      customization.selectedSize = "";
    } else {
      customization.selectedSize = size || "";
    }

    onSave?.({ customization });
    onClose?.();
  };

  if (!ci || !product) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandleBar} />
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle}>Tùy chỉnh sản phẩm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={PALETTE.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.productSummary}>
            <Image source={{ uri: product.image }} style={styles.productThumb} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.productName} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.productPrice}>{formatVND(product.price)}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
            <View style={{ gap: 16 }}>
              {Array.isArray(product?.colors) && product.colors.length > 0 ? (
                <View>
                  <SectionLabel label="Màu sắc gọng" />
                  <View style={styles.colorRow}>
                    {product.colors.map((color) => (
                      <TouchableOpacity
                        key={color.id}
                        onPress={() => setColorId(color.id)}
                        style={[
                          styles.colorDotWrap,
                          colorId === color.id && styles.colorDotWrapActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: color.hex || "#CCC" },
                          ]}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {!requiresLensRxFlow && Array.isArray(product?.sizes) && product.sizes.length > 0 ? (
                <View>
                  <SectionLabel label="Kích thước" />
                  <View style={styles.sizeRow}>
                    {product.sizes.map((item) => (
                      <TouchableOpacity
                        key={item}
                        onPress={() => setSize(item)}
                        style={[styles.sizePill, size === item && styles.sizePillActive]}
                      >
                        <Text style={[styles.sizeText, size === item && styles.sizeTextActive]}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            {requiresLensRxFlow ? (
              <View style={{ marginTop: 20, gap: 16 }}>
                <SectionLabel label="Thông số đơn kính" />
                <View style={styles.segmented}>
                  {LENS_METHOD_ITEMS.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setLensMethod(item.key)}
                      style={[
                        styles.segmentItem,
                        lensMethod === item.key && styles.segmentItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          lensMethod === item.key && styles.segmentTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {lensMethod === "upload" ? (
                  <View>
                    <Text style={styles.helperText}>
                      Tải ảnh đơn kính rõ nét để shop cập nhật lại thông tin tròng cho sản phẩm này.
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[styles.uploadBtn, isUploadingRxPhoto && styles.saveBtnDisabled]}
                      onPress={pickRxPhoto}
                      disabled={isUploadingRxPhoto}
                    >
                      <Ionicons
                        name={isUploadingRxPhoto ? "cloud-upload" : "cloud-upload-outline"}
                        size={18}
                        color={PALETTE.navy}
                      />
                      <Text style={styles.uploadBtnText}>
                        {isUploadingRxPhoto
                          ? "Đang tải ảnh..."
                          : lensDraft?.attachmentUrls?.length
                            ? "Đổi ảnh đơn kính"
                            : "Tải ảnh đơn kính"}
                      </Text>
                    </TouchableOpacity>

                    {lensDraft?.attachmentUrls?.length ? (
                      <View style={styles.uploadPreviewCard}>
                        <Image
                          source={{ uri: lensDraft.attachmentUrls[0] }}
                          style={styles.uploadPreviewImage}
                        />
                        <View style={styles.uploadPreviewMeta}>
                          <Text style={styles.uploadPreviewTitle}>Ảnh đơn kính đã tải</Text>
                          <Text style={styles.uploadPreviewHint}>
                            Ảnh này sẽ được lưu khi bạn bấm xác nhận
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryTitle}>{summary?.shortLabel || "Đơn kính"}</Text>
                    {Array.isArray(summary?.lines)
                      ? summary.lines.map((line) => (
                          <Text key={line} style={styles.summaryLine}>
                            {line}
                          </Text>
                        ))
                      : null}
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isOut && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isOut}
            >
              <Text style={styles.saveText}>Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: PALETTE.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  sheetHeader: { alignItems: "center", paddingVertical: 12 },
  sheetHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: PALETTE.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: PALETTE.text },
  closeBtn: { padding: 4, backgroundColor: PALETTE.bg, borderRadius: 20 },
  productSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 12,
    backgroundColor: PALETTE.bg,
    borderRadius: 16,
    marginBottom: 16,
  },
  productThumb: { width: 50, height: 50, borderRadius: 10, backgroundColor: PALETTE.white },
  productName: { fontSize: 14, fontWeight: "800", color: PALETTE.text },
  productPrice: { fontSize: 14, fontWeight: "900", color: PALETTE.navy, marginTop: 2 },
  formContent: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionLabel: { fontSize: 15, fontWeight: "900", color: PALETTE.text, marginBottom: 12 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorDotWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotWrapActive: { borderColor: PALETTE.navy },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  sizeRow: { flexDirection: "row", gap: 10 },
  sizePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: PALETTE.bg,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  sizePillActive: { backgroundColor: PALETTE.navy, borderColor: PALETTE.navy },
  sizeText: { fontSize: 13, fontWeight: "800", color: PALETTE.text },
  sizeTextActive: { color: PALETTE.white },
  segmented: {
    flexDirection: "row",
    backgroundColor: PALETTE.bg,
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: { backgroundColor: PALETTE.white },
  segmentText: { fontSize: 12, fontWeight: "900", color: PALETTE.muted },
  segmentTextActive: { color: PALETTE.navy },
  helperText: { fontSize: 12.5, fontWeight: "700", color: PALETTE.muted, lineHeight: 18 },
  uploadBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PALETTE.navy,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },
  uploadBtnText: { color: PALETTE.navy, fontSize: 13, fontWeight: "900" },
  uploadPreviewCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.bg,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  uploadPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: PALETTE.white,
  },
  uploadPreviewMeta: { flex: 1, gap: 4 },
  uploadPreviewTitle: { fontSize: 12.5, fontWeight: "900", color: PALETTE.text },
  uploadPreviewHint: { fontSize: 11.5, fontWeight: "700", color: PALETTE.muted },
  summaryBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.bg,
    padding: 12,
    gap: 6,
  },
  summaryTitle: { fontSize: 13, fontWeight: "900", color: PALETTE.text },
  summaryLine: { fontSize: 12, fontWeight: "700", color: PALETTE.muted },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: PALETTE.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "800", color: PALETTE.muted },
  saveBtn: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.6, backgroundColor: PALETTE.border },
  saveText: { fontSize: 15, fontWeight: "900", color: PALETTE.white },
});
