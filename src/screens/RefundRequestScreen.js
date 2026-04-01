import React, { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

import {
  cancelOrderApi,
  getOrderByIdApi,
  requestRefundApi,
  updateRefundApi,
} from "../services/orderService";
import {
  getMyRefundAccountApi,
  upsertMyRefundAccountApi,
} from "../services/userService";
import { uploadFileApi } from "../services/uploadService";
import {
  REFUND_BANK_OPTIONS,
  findRefundBankByCode,
  normalizeRefundAccountNumber,
  isRefundAccountNumberFormatValid,
} from "../data/refundBanks";

const PALETTE = {
  navy: "#0c2c5c",
  navySoft: "#17365D",
  navyTint: "#EEF3F8",
  bg: "#F6F7FB",
  white: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  error: "#DC2626",
};

const REFUND_REASON_OPTIONS = [
  { code: "wrong_item", label: "Giao sai sản phẩm" },
  { code: "defective_item", label: "Sản phẩm lỗi" },
  { code: "damaged_delivery", label: "Sản phẩm bị hỏng" },
  { code: "duplicate_payment", label: "Thanh toán trùng" },
  { code: "order_cancelled", label: "Muốn hủy đơn / không nhận hàng" },
  { code: "other", label: "Lý do khác" },
];

function formatVND(value) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

function inferReasonCode(reason) {
  const normalizedReason = String(reason || "").trim().toLowerCase();
  if (!normalizedReason) return REFUND_REASON_OPTIONS[0].code;
  const matchedOption = REFUND_REASON_OPTIONS.find(
    (option) => option.label.trim().toLowerCase() === normalizedReason
  );
  return matchedOption?.code || "other";
}

export default function RefundRequestScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialOrder = route?.params?.order || null;
  const explicitOrderId = route?.params?.orderId || null;
  const requestedAction = String(route?.params?.refundAction || "").toLowerCase();
  const isCancelOrderMode = requestedAction === "cancel_order";

  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [submitting, setSubmitting] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [reasonCode, setReasonCode] = useState(REFUND_REASON_OPTIONS[0].code);
  const [reasonDetail, setReasonDetail] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [saveAsDefaultRefundAccount, setSaveAsDefaultRefundAccount] = useState(false);
  const [note, setNote] = useState("");

  const orderId = useMemo(
    () => explicitOrderId || order?._id || order?.id,
    [explicitOrderId, order]
  );

  useEffect(() => {
    if (!orderId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [latestOrder, savedAccount] = await Promise.all([
          getOrderByIdApi(orderId, false),
          getMyRefundAccountApi().catch(() => null),
        ]);

        if (latestOrder) {
          setOrder(latestOrder);
          const nextReasonCode =
            inferReasonCode(latestOrder?.refund?.reasonCode || latestOrder?.refund?.reason);
          setReasonCode(nextReasonCode);
          setReasonDetail(String(latestOrder?.refund?.reason || "").trim());
          setEvidence(
            Array.isArray(latestOrder?.refund?.evidence)
              ? latestOrder.refund.evidence.filter(Boolean)
              : []
          );
          setNote(String(latestOrder?.refund?.note || latestOrder?.refund?.contactNote || "").trim());
        }

        if (savedAccount) {
          setBankCode(savedAccount.bankCode || "");
          setAccountNumber(savedAccount.accountNumber || "");
          setAccountHolder(savedAccount.accountHolder || "");
        }
      } catch {
        Alert.alert("Lỗi", "Không tải được thông tin đơn hàng");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [orderId]);

  const summary = useMemo(() => {
    if (!order) {
      return {
        id: "--",
        total: 0,
        paidAmount: 0,
        shippingFee: 0,
        unpaidAmount: 0,
        refundStatus: "",
      };
    }

    return {
      id: order?.paymentCode || order?.code || "--",
      total: order?.total || 0,
      paidAmount: order?.paidAmount || 0,
      shippingFee: order?.shippingFee || 0,
      unpaidAmount: Math.max(0, Number(order?.total || 0) - Number(order?.paidAmount || 0)),
      refundStatus: String(order?.refund?.status || "").toLowerCase(),
    };
  }, [order]);

  const isCustomerUpdateMode =
    requestedAction === "customer_submit_info" ||
    summary.refundStatus === "waiting_customer_info";

  const submitLabel = isCancelOrderMode
    ? "Xác nhận hủy đơn"
    : isCustomerUpdateMode
      ? "Gửi bổ sung thông tin"
      : "Gửi yêu cầu hoàn tiền";

  const screenTitle = isCancelOrderMode
    ? "Hủy đơn hàng"
    : isCustomerUpdateMode
      ? "Bổ sung thông tin hoàn tiền"
      : "Yêu cầu hoàn tiền";

  const handleSubmit = async () => {
    if (!orderId) {
      Alert.alert("Thông báo", "Thiếu mã đơn hàng.");
      return;
    }

    if (!bankCode || !accountNumber || !accountHolder) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng");
      return;
    }

    if (!isRefundAccountNumberFormatValid(accountNumber)) {
      Alert.alert("Thông báo", "Số tài khoản ngân hàng không hợp lệ.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedBank = findRefundBankByCode(bankCode);
      const payload = {
        reason:
          reasonDetail.trim() ||
          REFUND_REASON_OPTIONS.find((item) => item.code === reasonCode)?.label,
        reasonCode,
        evidence,
        bankAccount: {
          bankCode,
          bankName: selectedBank?.name,
          accountNumber,
          accountHolder,
        },
        note,
      };

      if (isCustomerUpdateMode) {
        await updateRefundApi(orderId, { action: "customer_submit_info", ...payload });
      } else if (isCancelOrderMode) {
        await cancelOrderApi(orderId, payload);
      } else {
        await requestRefundApi(orderId, payload);
      }

      if (saveAsDefaultRefundAccount) {
        await upsertMyRefundAccountApi(payload.bankAccount).catch(() => null);
      }

      Alert.alert("Thành công", "Yêu cầu của bạn đã được gửi đi.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Lỗi", error?.response?.data?.message || "Không thể gửi yêu cầu");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickEvidence = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Lỗi", "Cần quyền truy cập thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingEvidence(true);
    try {
      const uploaded = await uploadFileApi(
        {
          uri: result.assets[0].uri,
          name: `refund-${Date.now()}.jpg`,
          type: "image/jpeg",
        },
        { folder: "refund-evidence" }
      );
      setEvidence((prev) => [...prev, uploaded.url]);
    } catch {
      Alert.alert("Lỗi", "Không thể tải ảnh lên");
    } finally {
      setUploadingEvidence(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{screenTitle}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PALETTE.navy} />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 8 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Mã đơn</Text>
                <Text style={styles.metaValue}>{summary.id}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Đã thanh toán</Text>
                <Text style={styles.metaValueStrong}>{formatVND(summary.paidAmount)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Tổng đơn</Text>
                <Text style={styles.metaValue}>{formatVND(summary.total)}</Text>
              </View>
              {summary.unpaidAmount > 0 ? (
                <View style={styles.rowBetween}>
                  <Text style={styles.metaLabel}>Chưa thanh toán</Text>
                  <Text style={styles.metaValue}>{formatVND(summary.unpaidAmount)}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Lý do hoàn tiền</Text>
              <View style={styles.reasonGrid}>
                {REFUND_REASON_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.code}
                    onPress={() => setReasonCode(option.code)}
                    style={[
                      styles.reasonChip,
                      reasonCode === option.code && styles.reasonChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        reasonCode === option.code && styles.reasonChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Mô tả chi tiết lý do..."
                placeholderTextColor={PALETTE.muted}
                multiline
                value={reasonDetail}
                onChangeText={setReasonDetail}
              />
              <TextInput
                style={[styles.input, styles.textareaSmall]}
                placeholder="Ghi chú thêm cho bộ phận xử lý..."
                placeholderTextColor={PALETTE.muted}
                multiline
                value={note}
                onChangeText={setNote}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tài khoản nhận tiền</Text>
              <Text style={styles.fieldLabel}>Ngân hàng</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={bankCode}
                  onValueChange={(itemValue) => setBankCode(itemValue)}
                  style={styles.picker}
                  dropdownIconColor={PALETTE.muted}
                  mode="dropdown"
                >
                  <Picker.Item label="Chọn ngân hàng" value="" color={PALETTE.muted} />
                  {REFUND_BANK_OPTIONS.map((bank) => (
                    <Picker.Item key={bank.code} label={bank.name} value={bank.code} />
                  ))}
                </Picker>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Số tài khoản"
                placeholderTextColor={PALETTE.muted}
                keyboardType="numeric"
                value={accountNumber}
                onChangeText={(value) => setAccountNumber(normalizeRefundAccountNumber(value))}
              />
              <TextInput
                style={styles.input}
                placeholder="Chủ tài khoản (VIET HOA KHONG DAU)"
                placeholderTextColor={PALETTE.muted}
                value={accountHolder}
                onChangeText={setAccountHolder}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setSaveAsDefaultRefundAccount((prev) => !prev)}
              >
                <Ionicons
                  name={saveAsDefaultRefundAccount ? "checkbox" : "square-outline"}
                  size={20}
                  color={PALETTE.navy}
                />
                <Text style={styles.toggleText}>Lưu làm tài khoản mặc định</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ảnh chứng từ / bằng chứng</Text>
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handlePickEvidence}
                disabled={uploadingEvidence}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={PALETTE.navy} />
                <Text style={styles.uploadBtnText}>
                  {uploadingEvidence ? "Đang tải lên..." : "Chọn ảnh chứng từ"}
                </Text>
              </TouchableOpacity>

              <View style={styles.evidenceGrid}>
                {evidence.map((url, index) => (
                  <View key={`${url}-${index}`} style={styles.evidenceItem}>
                    <Image source={{ uri: url }} style={styles.evidenceImage} />
                    <TouchableOpacity
                      style={styles.removeEvidenceBtn}
                      onPress={() => setEvidence((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>{submitLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  header: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: PALETTE.text },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: PALETTE.text, marginBottom: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginVertical: 6,
  },
  metaLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: PALETTE.muted },
  metaValue: { fontSize: 13, fontWeight: "800", color: PALETTE.text },
  metaValueStrong: { fontSize: 14, fontWeight: "900", color: PALETTE.navy },
  fieldLabel: { fontSize: 13, fontWeight: "900", color: PALETTE.text, marginBottom: 6 },
  pickerContainer: {
    backgroundColor: PALETTE.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginTop: 8,
    overflow: "hidden",
  },
  picker: {
    height: 50,
    width: "100%",
    color: PALETTE.text,
  },
  input: {
    backgroundColor: PALETTE.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginTop: 10,
    fontSize: 13,
    fontWeight: "800",
    color: PALETTE.text,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  textarea: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  textareaSmall: {
    height: 88,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 10,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PALETTE.bg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  reasonChipActive: {
    backgroundColor: PALETTE.navyTint,
    borderColor: PALETTE.navy,
  },
  reasonChipText: { fontSize: 12, fontWeight: "800", color: PALETTE.muted },
  reasonChipTextActive: { color: PALETTE.navy },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 15 },
  toggleText: { fontSize: 13, fontWeight: "800", color: PALETTE.text, flex: 1 },
  uploadBtn: {
    backgroundColor: PALETTE.navyTint,
    borderRadius: 14,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: PALETTE.navy,
    borderStyle: "dashed",
    paddingHorizontal: 12,
  },
  uploadBtnText: { color: PALETTE.navy, fontWeight: "900", fontSize: 13 },
  evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 15 },
  evidenceItem: { position: "relative" },
  evidenceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: PALETTE.border,
  },
  removeEvidenceBtn: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: PALETTE.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    backgroundColor: PALETTE.bg,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    width: 96,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  cancelText: { color: "#B91C1C", fontSize: 14, fontWeight: "900" },
  submitBtn: {
    flex: 1,
    backgroundColor: PALETTE.navy,
    borderRadius: 16,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});