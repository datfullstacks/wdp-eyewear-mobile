import React, { useCallback, useEffect, useMemo, useState } from "react";
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

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
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
  product,
  method,
  onChangeMethod,
  lensDraft,
  setLensDraft,
  pickRxPhoto,
}) {
  const validation = useMemo(
    () =>
      validateLensPrescriptionDraft({
        method,
        draft: lensDraft,
        product,
      }),
    [lensDraft, method, product]
  );
  const summary = useMemo(
    () =>
      summarizeLensPrescription(
        buildLensPrescriptionPayload({
          method,
          draft: lensDraft,
        })
      ),
    [lensDraft, method]
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
    <View style={{ gap: 14 }}>
      <MethodSegmented value={valueOrDefault(method)} onChange={onChangeMethod} />

      {method === "upload" ? (
        <View>
          <Text style={styles.hintText}>
            Tải ảnh đơn kính để shop nhập thông số theo toa của bạn.
          </Text>
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
          {lensDraft?.attachmentUrls?.length ? (
            <Text style={styles.hintText}>Đã chọn ảnh đơn kính.</Text>
          ) : null}
        </View>
      ) : (
        <>
          <SectionLabel label="Mắt phải (OD)" />
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

          <SectionLabel label="Mắt trái (OS)" />
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

function FrameEditForm({ product, colorId, setColorId, size, setSize }) {
  const hasColors = Array.isArray(product?.colors) && product.colors.length > 0;
  const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;

  return (
    <View style={{ gap: 16 }}>
      {hasColors ? (
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {hasSizes ? (
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
      ) : null}
    </View>
  );
}

function valueOrDefault(value) {
  return value === "upload" ? "upload" : "manual";
}

export default function CartItemEditModal({ visible, cartItem, onClose, onSave }) {
  const ci = cartItem;
  const product = ci?.product;
  const catalogType = product?.catalogType || product?.type;
  const requiresLensRxFlow = Boolean(product?.requiresLensRxFlow);
  const isOut = (product?.totalStock ?? 1) <= 0 && !product?.preOrder?.enabled;

  const [lensMethod, setLensMethod] = useState("manual");
  const [lensDraft, setLensDraft] = useState(() => normalizeLensPrescriptionDraft());
  const [colorId, setColorId] = useState(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    if (!visible || !ci) return;

    if (requiresLensRxFlow) {
      const prescription = ci?.customization?.prescription || {};
      setLensMethod(inferLensPrescriptionMethod(prescription));
      setLensDraft(normalizeLensPrescriptionDraft(prescription));

      const selectedColor = ci?.customization?.selectedColor;
      const matchedColor =
        product?.colors?.find(
          (c) =>
            String(c.id) === String(selectedColor) ||
            String(c.name || c.label || "").toLowerCase() ===
              String(selectedColor || "").toLowerCase()
        ) || null;
      setColorId(matchedColor?.id || product?.colors?.[0]?.id || null);
      setSize(null);
      return;
    }

    const selectedColor = ci?.customization?.selectedColor;
    const matchedColor =
      product?.colors?.find(
        (c) =>
          String(c.id) === String(selectedColor) ||
          String(c.name || c.label || "").toLowerCase() ===
            String(selectedColor || "").toLowerCase()
      ) || null;
    setColorId(matchedColor?.id || product?.colors?.[0]?.id || null);
    setSize(ci?.customization?.selectedSize || product?.sizes?.[0] || null);
  }, [visible, ci, product, requiresLensRxFlow]);

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
    if (isOut) {
      Alert.alert("Hết hàng", "Sản phẩm này đã hết hàng, không thể chỉnh sửa.");
      return;
    }

    if (requiresLensRxFlow) {
      const validation = validateLensPrescriptionDraft({
        method: lensMethod,
        draft: lensDraft,
        product,
      });
      if (!validation.valid) {
        Alert.alert("Thiếu thông số", validation.errors[0] || "Vui lòng kiểm tra lại đơn kính.");
        return;
      }

      const colorObj = product?.colors?.find((c) => c.id === colorId);
      onSave?.({
        customization: {
          ...(ci?.customization || {}),
          selectedColor: colorObj?.name || colorObj?.label || colorId || "",
          selectedSize: "",
          prescription: buildLensPrescriptionPayload({
            method: lensMethod,
            draft: lensDraft,
          }),
        },
      });
      onClose?.();
      return;
    }

    const colorObj = product?.colors?.find((c) => c.id === colorId);
    onSave?.({
      customization: {
        ...(ci?.customization || {}),
        selectedColor: colorObj?.name || colorObj?.label || colorId || "",
        selectedSize: size || "",
      },
    });
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
            <Text style={styles.sheetTitle}>Chỉnh sửa sản phẩm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.productSummary}>
            <Image source={{ uri: product.image }} style={styles.productThumb} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.productMetaText}>
                {product.displayLabel || catalogType || "Sản phẩm"}
              </Text>
              <Text style={styles.productPrice}>{formatVND(product.price)}</Text>
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
              {requiresLensRxFlow ? (
                <LensEditForm
                  product={product}
                  method={lensMethod}
                  onChangeMethod={setLensMethod}
                  lensDraft={lensDraft}
                  setLensDraft={setLensDraft}
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

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isOut && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isOut}
              activeOpacity={0.9}
            >
              <Ionicons name="checkmark" size={16} color={isOut ? "#9CA3AF" : "#FFFFFF"} />
              <Text style={[styles.saveText, isOut && styles.saveTextDisabled]}>
                Lưu thay đổi
              </Text>
            </TouchableOpacity>
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
  sheetHeader: { alignItems: "center", paddingTop: 10 },
  sheetHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  productThumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: "#F3F4F6" },
  productName: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  productMetaText: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  productPrice: { marginTop: 6, fontSize: 13, fontWeight: "900", color: "#111827" },
  disabledNotice: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
  },
  disabledNoticeText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#B45309" },
  formScroll: { maxHeight: 460 },
  formContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  sectionLabel: { fontSize: 12.5, fontWeight: "900", color: "#111827" },
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
  hintText: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#6B7280" },
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
  saveBtnDisabled: { backgroundColor: "#E5E7EB" },
  saveText: { color: "#FFFFFF", fontWeight: "900" },
  saveTextDisabled: { color: "#9CA3AF" },
});
