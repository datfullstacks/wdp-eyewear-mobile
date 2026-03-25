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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

import {
  getOrderByIdApi,
  requestRefundApi,
  updateRefundApi,
} from "../services/orderService";
import { uploadFileApi } from "../services/uploadService";
import {
  REFUND_BANK_OPTIONS,
  findRefundBankByCode,
  findRefundBankByName,
  normalizeRefundAccountNumber,
  isRefundAccountNumberFormatValid,
} from "../data/refundBanks";

const REFUND_REASON_OPTIONS = [
  { code: "wrong_item", label: "Giao sai sản phẩm" },
  { code: "defective_item", label: "Sản phẩm lỗi" },
  { code: "damaged_delivery", label: "Sản phẩm bị hỏng" },
  { code: "duplicate_payment", label: "Thanh toán trùng" },
  { code: "order_cancelled", label: "Muốn hủy đơn / không nhận hàng" },
  { code: "other", label: "Lý do khác" },
];

function formatVND(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function resolveOrderId(explicitOrderId, order) {
  return (
    explicitOrderId ||
    order?._id ||
    order?.id ||
    order?.orderId ||
    order?.code ||
    null
  );
}

function normalizeRefundStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function toNumber(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

function toPositiveNumber(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function inferReasonCode(reason) {
  const normalizedReason = String(reason || "").trim().toLowerCase();
  if (!normalizedReason) {
    return REFUND_REASON_OPTIONS[0].code;
  }

  const matchedOption = REFUND_REASON_OPTIONS.find((option) => {
    return option.label.trim().toLowerCase() === normalizedReason;
  });

  return matchedOption?.code || "other";
}

function getRefundPaidAmount(order) {
  return Math.max(0, Number(order?.paidAmount || 0));
}

function normalizeOrderStatusKey(order) {
  return String(order?.status || "")
    .trim()
    .toLowerCase();
}

function canCustomerCreateRefundRequest(order) {
  return (
    getRefundPaidAmount(order) > 0 &&
    ["pending", "cancelled", "delivered", "returned"].includes(
      normalizeOrderStatusKey(order),
    )
  );
}

function getRefundEligibilityMessage(order) {
  if (getRefundPaidAmount(order) <= 0) {
    return "Đơn hàng này chưa có khoản thanh toán có thể hoàn.";
  }

  return "Yêu cầu refund chỉ áp dụng cho đơn đã thanh toán đang chờ xác nhận, đã hủy, đã giao hoặc đã trả.";
}

function getRefundShippingFeeLimit(order) {
  const shippingCollectionTiming = String(
    order?.shippingCollectionTiming ||
      order?.breakdown?.shippingCollectionTiming ||
      "upfront",
  )
    .trim()
    .toLowerCase();

  if (shippingCollectionTiming !== "upfront") {
    return 0;
  }

  return Math.min(
    Math.max(0, Number(order?.shippingFee ?? order?.breakdown?.shippingFee ?? 0)),
    getRefundPaidAmount(order),
  );
}

function getDefaultRefundableItemAmount(order) {
  return Math.max(
    0,
    getRefundPaidAmount(order) - getRefundShippingFeeLimit(order),
  );
}

function clampRefundBreakdown(order, breakdown = {}) {
  const shippingFeeAmount = Math.min(
    Math.max(0, Number(breakdown.shippingFeeAmount || 0)),
    getRefundShippingFeeLimit(order),
  );
  const paidAmount = getRefundPaidAmount(order);
  const maxItemAmount = Math.max(0, paidAmount - shippingFeeAmount);
  const itemAmount = Math.min(
    Math.max(0, Number(breakdown.itemAmount || 0)),
    maxItemAmount,
  );
  const returnShippingFeeAmount = Math.max(
    0,
    Number(breakdown.returnShippingFeeAmount || 0),
  );

  return {
    itemAmount,
    shippingFeeAmount,
    returnShippingFeeAmount,
    total: itemAmount + shippingFeeAmount + returnShippingFeeAmount,
  };
}

function buildOrderSummary(order) {
  const breakdown = order?.breakdown || {};
  const shippingFee = Number(breakdown.shippingFee ?? order?.shippingFee ?? 0);
  const total = Number(breakdown.total ?? order?.total ?? 0);
  const subtotal = Number(breakdown.subtotal ?? order?.subtotal ?? total);
  const discountAmount = Number(
    breakdown.discountAmount ?? order?.discountAmount ?? order?.discount ?? 0,
  );
  const paidAmount = getRefundPaidAmount(order);
  const unpaidAmount = Math.max(0, total - paidAmount);
  const refundStatus = normalizeRefundStatus(order?.refund?.status);

  return {
    id: order?.code || order?.orderId || order?._id || order?.id || "--",
    orderStatus: normalizeOrderStatusKey(order),
    subtotal,
    discountAmount,
    shippingFee,
    total,
    paidAmount,
    unpaidAmount,
    payNowTotal: Number(breakdown.payNow ?? order?.payNowTotal ?? 0),
    payLaterTotal: Number(breakdown.payLater ?? order?.payLaterTotal ?? 0),
    shippingCollectionTiming: String(
      breakdown.shippingCollectionTiming ||
        order?.shippingCollectionTiming ||
        "upfront",
    )
      .trim()
      .toLowerCase(),
    refundStatus,
    refundContactNote: String(order?.refund?.contactNote || "").trim(),
    refundDecisionNote: String(order?.refund?.decisionNote || "").trim(),
    refundReason: String(order?.refund?.reason || "").trim(),
    refundRequiresReturn: Boolean(order?.refund?.requiresReturn),
    refundBankAccount: order?.refund?.bankAccount || null,
    requestedBreakdown: clampRefundBreakdown(
      order,
      order?.refund?.requestedBreakdown || {
        itemAmount: getDefaultRefundableItemAmount(order),
        shippingFeeAmount: 0,
        returnShippingFeeAmount: 0,
      },
    ),
  };
}

function buildRequestedBreakdown(
  order,
  itemAmountSeed,
  requestShippingFee,
  returnShippingFee,
) {
  const shippingFeeAmount = requestShippingFee ? getRefundShippingFeeLimit(order) : 0;
  const paidAmount = getRefundPaidAmount(order);
  const maxItemAmount = Math.max(0, paidAmount - shippingFeeAmount);
  const fallbackItemAmount = getDefaultRefundableItemAmount(order);
  const itemAmount = Math.min(
    Math.max(0, Number(itemAmountSeed || fallbackItemAmount)),
    maxItemAmount,
  );
  const normalizedReturnShippingFee = Math.max(
    0,
    Number(returnShippingFee || 0),
  );

  return {
    itemAmount,
    shippingFeeAmount,
    returnShippingFeeAmount: normalizedReturnShippingFee,
    total: itemAmount + shippingFeeAmount + normalizedReturnShippingFee,
  };
}

function buildInitialFormState(order) {
  const summary = buildOrderSummary(order);
  const currentBreakdown = summary.requestedBreakdown;
  const bankAccount = summary.refundBankAccount || {};
  const resolvedBank =
    findRefundBankByCode(bankAccount.bankCode) ||
    findRefundBankByName(bankAccount.bankName);

  return {
    reasonCode: inferReasonCode(summary.refundReason),
    reasonDetail: summary.refundReason || "",
    requestShippingFee: Number(currentBreakdown.shippingFeeAmount || 0) > 0,
    requiresReturn: summary.refundRequiresReturn,
    returnShippingFeeText:
      currentBreakdown.returnShippingFeeAmount > 0
        ? String(currentBreakdown.returnShippingFeeAmount)
        : "",
    itemAmountSeed:
      currentBreakdown.itemAmount > 0
        ? Number(currentBreakdown.itemAmount)
        : getDefaultRefundableItemAmount(order),
    bankCode: resolvedBank?.code || "",
    bankName: resolvedBank?.name || String(bankAccount.bankName || "").trim(),
    accountNumber: normalizeRefundAccountNumber(bankAccount.accountNumber || ""),
    accountHolder: String(bankAccount.accountHolder || "").trim(),
    bankNote: String(bankAccount.note || "").trim(),
    evidence:
      Array.isArray(order?.refund?.evidence) &&
      order.refund.evidence.length > 0
        ? order.refund.evidence
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        : [],
    note: "",
  };
}

function ToggleRow({ label, value, onToggle, helper, disabled = false }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
      </View>

      <TouchableOpacity
        activeOpacity={disabled ? 1 : 0.85}
        style={[
          styles.togglePill,
          value && styles.togglePillActive,
          disabled && styles.togglePillDisabled,
        ]}
        disabled={disabled}
        onPress={onToggle}
      >
        <Text
          style={[
            styles.togglePillText,
            value && styles.togglePillTextActive,
            disabled && styles.togglePillTextDisabled,
          ]}
        >
          {value ? "Bat" : "Tat"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RefundRequestScreen({ navigation, route }) {
  const initialOrder = route?.params?.order || null;
  const explicitOrderId = route?.params?.orderId || null;
  const requestedAction = normalizeRefundStatus(route?.params?.refundAction);

  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [submitting, setSubmitting] = useState(false);
  const [formSeedKey, setFormSeedKey] = useState("");

  const [reasonCode, setReasonCode] = useState(REFUND_REASON_OPTIONS[0].code);
  const [reasonDetail, setReasonDetail] = useState("");
  const [requestShippingFee, setRequestShippingFee] = useState(false);
  const [requiresReturn, setRequiresReturn] = useState(false);
  const [returnShippingFeeText, setReturnShippingFeeText] = useState("");
  const [itemAmountSeed, setItemAmountSeed] = useState(0);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankNote, setBankNote] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [note, setNote] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const orderId = useMemo(
    () => resolveOrderId(explicitOrderId, order || initialOrder),
    [explicitOrderId, initialOrder, order],
  );

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadOrder = async () => {
      try {
        setLoading(true);
        const latestOrder = await getOrderByIdApi(orderId, false);
        if (mounted && latestOrder) {
          setOrder(latestOrder);
        }
      } catch (error) {
        if (mounted) {
          const message =
            error?.response?.data?.message ||
            error?.message ||
            "Không tải được thông tin đơn hàng";
          Alert.alert("Refund", message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  const summary = useMemo(() => buildOrderSummary(order), [order]);
  const isWaitingCustomerInfo = summary.refundStatus === "waiting_customer_info";
  const isCustomerUpdateMode =
    requestedAction === "customer_submit_info" || isWaitingCustomerInfo;
  const canCreateRefund = useMemo(
    () => canCustomerCreateRefundRequest(order),
    [order],
  );
  const refundEligibilityMessage = useMemo(
    () => getRefundEligibilityMessage(order),
    [order],
  );
  const returnShippingFee = useMemo(
    () => toNumber(returnShippingFeeText),
    [returnShippingFeeText],
  );
  const refundableShippingFee = useMemo(
    () => getRefundShippingFeeLimit(order),
    [order],
  );
  const requestedBreakdown = useMemo(
    () =>
      buildRequestedBreakdown(
        order,
        itemAmountSeed,
        requestShippingFee,
        returnShippingFee,
      ),
    [order, itemAmountSeed, requestShippingFee, returnShippingFee],
  );
  const selectedReason =
    REFUND_REASON_OPTIONS.find((option) => option.code === reasonCode) ||
    REFUND_REASON_OPTIONS[0];

  const hasExistingRefund =
    summary.refundStatus &&
    !["none", "completed", "rejected"].includes(summary.refundStatus);
  const hasBlockingActiveRefund = hasExistingRefund && !isCustomerUpdateMode;
  const shippingFeeHelper =
    refundableShippingFee > 0
      ? "Bật khi lỗi đến từ hệ thống, giao sai hàng hoặc giao hỏng."
      : "Phí ship hiện chưa thu ở đợt đã thanh toán nên không thể refund trong lúc này.";

  useEffect(() => {
    if (!orderId) return;

    const refundUpdatedAt =
      order?.refund?.requestedAt ||
      order?.refund?.approvedAt ||
      order?.refund?.processedAt ||
      "";
    const nextSeedKey = [
      orderId,
      summary.refundStatus,
      refundUpdatedAt,
      summary.paidAmount,
      summary.total,
    ].join("|");

    if (nextSeedKey === formSeedKey) {
      return;
    }

    const nextState = buildInitialFormState(order);
    setReasonCode(nextState.reasonCode);
    setReasonDetail(nextState.reasonDetail);
    setRequestShippingFee(nextState.requestShippingFee);
    setRequiresReturn(nextState.requiresReturn);
    setReturnShippingFeeText(nextState.returnShippingFeeText);
    setItemAmountSeed(nextState.itemAmountSeed);
    setBankCode(nextState.bankCode);
    setBankName(nextState.bankName);
    setAccountNumber(nextState.accountNumber);
    setAccountHolder(nextState.accountHolder);
    setBankNote(nextState.bankNote);
    setEvidence(nextState.evidence);
    setNote(nextState.note);
    setFormSeedKey(nextSeedKey);
  }, [
    formSeedKey,
    order,
    orderId,
    summary.paidAmount,
    summary.refundStatus,
    summary.total,
  ]);

  const handleSubmit = async () => {
    if (submitting) return;

    if (!orderId) {
      Alert.alert("Refund", "Không tìm thấy mã đơn hàng.");
      return;
    }

    if (hasBlockingActiveRefund) {
      Alert.alert("Refund", "Đơn hàng này đã có yêu cầu hoàn tiền đang xử lý.");
      return;
    }

    if (isCustomerUpdateMode && !isWaitingCustomerInfo) {
      Alert.alert(
        "Refund",
        "Case refund hiện không ở trạng thái chờ bổ sung thông tin.",
      );
      return;
    }

    if (!isCustomerUpdateMode && !canCreateRefund) {
      Alert.alert("Refund", refundEligibilityMessage);
      return;
    }

    if (!bankCode.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      Alert.alert(
        "Refund",
        "Vui lòng chọn ngân hàng, nhập số tài khoản và chủ tài khoản.",
      );
      return;
    }

    const selectedBank = findRefundBankByCode(bankCode);
    if (!selectedBank) {
      Alert.alert("Refund", "Ngân hàng đã chọn không hợp lệ.");
      return;
    }

    const normalizedAccountNumber = normalizeRefundAccountNumber(accountNumber);
    if (!isRefundAccountNumberFormatValid(normalizedAccountNumber)) {
      Alert.alert("Refund", "Số tài khoản phải gồm 8 đến 19 chữ số.");
      return;
    }

    if (requestedBreakdown.total <= 0) {
      Alert.alert(
        "Refund",
        "Số tiền đề nghị refund phải lớn hơn 0 và không vượt quá số tiền đã thanh toán.",
      );
      return;
    }

    const payload = {
      reason: reasonDetail.trim() || selectedReason.label,
      reasonCode,
      requestShippingFee,
      requiresReturn,
      customerPaidReturnShippingFee: returnShippingFee,
      note: note.trim(),
      evidence,
      requestedBreakdown,
      bankAccount: {
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        accountNumber: normalizedAccountNumber,
        accountHolder: accountHolder.trim(),
        note: bankNote.trim(),
      },
    };

    try {
      setSubmitting(true);

      if (isCustomerUpdateMode) {
        await updateRefundApi(orderId, {
          action: "customer_submit_info",
          ...payload,
        });
      } else {
        await requestRefundApi(orderId, payload);
      }

      Alert.alert(
        "Refund",
        isCustomerUpdateMode
          ? "Đã gửi bổ sung thông tin refund. Staff sẽ tiếp tục review."
          : "Đã gửi yêu cầu hoàn tiền. Staff sẽ tiếp nhận và cập nhật trạng thái sớm.",
        [
          {
            text: "OK",
            onPress: () =>
              navigation?.canGoBack?.() ? navigation.goBack() : null,
          },
        ],
      );
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        (isCustomerUpdateMode
          ? "Không cập nhật được thông tin refund"
          : "Không tạo được yêu cầu hoàn tiền");
      Alert.alert("Refund", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickEvidence = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Refund", "Vui lòng cấp quyền truy cập thư viện ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return;
    }

    try {
      setUploadingEvidence(true);
      const uploaded = await uploadFileApi(
        {
          uri: asset.uri,
          name: asset.fileName || `refund-evidence-${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        },
        {
          folder: "refund-evidence",
        },
      );
      setEvidence((current) => {
        const next = [...current, String(uploaded.url || "").trim()].filter(Boolean);
        return Array.from(new Set(next)).slice(0, 6);
      });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Không tải ảnh chứng từ lên được";
      Alert.alert("Refund", message);
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleRemoveEvidence = (url) => {
    setEvidence((current) => current.filter((item) => item !== url));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() =>
              navigation?.canGoBack?.() ? navigation.goBack() : null
            }
            activeOpacity={0.85}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
              {isCustomerUpdateMode
              ? "Bổ sung thông tin hoàn tiền"
              : "Yêu cầu hoàn tiền"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Mã đơn</Text>
              <Text style={styles.metaValue}>{summary.id}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Tiền hàng</Text>
              <Text style={styles.metaValue}>
                {formatVND(Math.max(summary.total - summary.shippingFee, 0))}
              </Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Phí giao hàng</Text>
              <Text style={styles.metaValue}>{formatVND(summary.shippingFee)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Đã thanh toán</Text>
              <Text style={styles.metaValue}>{formatVND(summary.paidAmount)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Chưa thu</Text>
              <Text style={styles.metaValue}>{formatVND(summary.unpaidAmount)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.metaLabel}>Tổng đơn</Text>
              <Text style={styles.metaValueStrong}>{formatVND(summary.total)}</Text>
            </View>

            {summary.payLaterTotal > 0 ? (
              <Text style={styles.noticeText}>
                Refund hiện tại chỉ áp dụng trên tiền cọc/tiền đã thanh toán.
              </Text>
            ) : null}
          </View>

          {isCustomerUpdateMode &&
          (summary.refundContactNote || summary.refundDecisionNote) ? (
            <View style={[styles.card, styles.noticeCard]}>
              <Text style={styles.sectionTitle}>Staff cần bổ sung</Text>
              {summary.refundDecisionNote ? (
                <Text style={styles.noticeText}>{summary.refundDecisionNote}</Text>
              ) : null}
              {summary.refundContactNote ? (
                <Text style={styles.noticeText}>{summary.refundContactNote}</Text>
              ) : null}
            </View>
          ) : null}

          {!isCustomerUpdateMode && !canCreateRefund ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Chưa thể tạo refund</Text>
              <Text style={styles.helperText}>{refundEligibilityMessage}</Text>
            </View>
          ) : hasBlockingActiveRefund ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Đơn đã có refund</Text>
              <Text style={styles.helperText}>
                Đơn hàng này đã có yêu cầu hoàn tiền đang xử lý. Vui lòng quay
                lại màn hình chi tiết đơn để theo dõi trạng thái.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {isCustomerUpdateMode
                    ? "Cập nhật lý do và thông tin"
                    : "Lý do hoàn tiền"}
                </Text>
                <View style={styles.reasonGrid}>
                  {REFUND_REASON_OPTIONS.map((option) => {
                    const active = option.code === reasonCode;

                    return (
                      <TouchableOpacity
                        key={option.code}
                        activeOpacity={0.85}
                        style={[
                          styles.reasonChip,
                          active && styles.reasonChipActive,
                        ]}
                        onPress={() => setReasonCode(option.code)}
                      >
                        <Text
                          style={[
                            styles.reasonChipText,
                            active && styles.reasonChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Mô tả chi tiết</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="Mô tả vấn đề, tình trạng sản phẩm hoặc lý do cần refund..."
                  multiline
                  textAlignVertical="top"
                  value={reasonDetail}
                  onChangeText={setReasonDetail}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Điều kiện refund</Text>
                <ToggleRow
                  label="Yêu cầu hoàn phí giao hàng"
                  helper={shippingFeeHelper}
                  value={requestShippingFee}
                  disabled={refundableShippingFee <= 0}
                  onToggle={() => setRequestShippingFee((value) => !value)}
                />
                <ToggleRow
                  label="Cần trả hàng"
                  helper="Bật nếu khách cần gửi hàng về để đối soát trước khi hoàn tiền."
                  value={requiresReturn}
                  onToggle={() => setRequiresReturn((value) => !value)}
                />

                <Text style={styles.fieldLabel}>Phí gửi trả hàng đã trả</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={returnShippingFeeText}
                  onChangeText={setReturnShippingFeeText}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Tài khoản nhận tiền</Text>
                <Text style={styles.fieldLabel}>Ngân hàng</Text>
                <View style={styles.pickerBox}>
                  <Picker
                    selectedValue={bankCode}
                    onValueChange={(value) => {
                      const selectedBank = findRefundBankByCode(value);
                      setBankCode(String(value || ""));
                      setBankName(selectedBank?.name || "");
                    }}
                  >
                    <Picker.Item label="Chọn ngân hàng" value="" />
                    {REFUND_BANK_OPTIONS.map((bank) => (
                      <Picker.Item
                        key={bank.code}
                        label={bank.name}
                        value={bank.code}
                      />
                    ))}
                  </Picker>
                </View>
                <Text style={styles.helperText}>
                  Chọn đúng ngân hàng nhận refund. Hệ thống sẽ lưu theo mã ngân hàng đã chọn.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Số tài khoản"
                  keyboardType="numeric"
                  value={accountNumber}
                  onChangeText={(value) =>
                    setAccountNumber(normalizeRefundAccountNumber(value))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Chủ tài khoản"
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                />
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="Ghi chú tài khoản (nếu có)"
                  multiline
                  textAlignVertical="top"
                  value={bankNote}
                  onChangeText={setBankNote}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Ảnh chứng từ / bằng chứng</Text>
                <Text style={styles.helperText}>
                  Thêm ảnh nếu cần chứng minh giao sai, sản phẩm lỗi, hàng hỏng
                  hoặc nội dung staff đang yêu cầu.
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.uploadBtn,
                    uploadingEvidence && styles.submitBtnDisabled,
                  ]}
                  onPress={handlePickEvidence}
                  disabled={uploadingEvidence || evidence.length >= 6}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color="#2563EB"
                  />
                  <Text style={styles.uploadBtnText}>
                    {uploadingEvidence
                      ? "Đang upload..."
                      : evidence.length >= 6
                        ? "Đã đạt giới hạn 6 ảnh"
                        : "Chọn ảnh chứng từ"}
                  </Text>
                </TouchableOpacity>

                {evidence.length > 0 ? (
                  <View style={styles.evidenceGrid}>
                    {evidence.map((url, index) => (
                      <View key={`${url}-${index}`} style={styles.evidenceItem}>
                        <Image source={{ uri: url }} style={styles.evidenceImage} />
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={styles.removeEvidenceBtn}
                          onPress={() => handleRemoveEvidence(url)}
                        >
                          <Ionicons name="close" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Tổng hợp số tiền đề nghị</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaLabel}>Tiền hàng</Text>
                  <Text style={styles.metaValue}>
                    {formatVND(requestedBreakdown.itemAmount)}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaLabel}>Phí giao hàng</Text>
                  <Text style={styles.metaValue}>
                    {formatVND(requestedBreakdown.shippingFeeAmount)}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaLabel}>Phí gửi trả hàng</Text>
                  <Text style={styles.metaValue}>
                    {formatVND(requestedBreakdown.returnShippingFeeAmount)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.rowBetween}>
                  <Text style={styles.totalLabel}>Tổng đề nghị refund</Text>
                  <Text style={styles.totalValue}>
                    {formatVND(requestedBreakdown.total)}
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {isCustomerUpdateMode ? "Nội dung bổ sung" : "Ghi chú thêm"}
                </Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder={
                    isCustomerUpdateMode
                      ? "Bổ sung thêm thông tin/chứng từ cho staff..."
                      : "Thêm mô tả cho staff nếu cần..."
                  }
                  multiline
                  textAlignVertical="top"
                  value={note}
                  onChangeText={setNote}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitText}>
                  {submitting
                    ? "Đang gửi..."
                    : isCustomerUpdateMode
                      ? "Gửi bổ sung thông tin"
                      : "Gửi yêu cầu hoàn tiền"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  noticeCard: {
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  fieldLabel: {
    marginTop: 12,
    fontSize: 12.5,
    fontWeight: "800",
    color: "#374151",
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    lineHeight: 18,
  },
  noticeText: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#4B5563",
    lineHeight: 18,
  },
  input: {
    marginTop: 8,
    height: 42,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  pickerBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  textarea: {
    height: 96,
    paddingTop: 12,
    paddingBottom: 12,
  },
  reasonGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  reasonChipActive: {
    backgroundColor: "#DBEAFE",
  },
  reasonChipText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#4B5563",
  },
  reasonChipTextActive: {
    color: "#1D4ED8",
  },
  toggleRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleTextWrap: {
    flex: 1,
  },
  togglePill: {
    minWidth: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  togglePillActive: {
    backgroundColor: "#DBEAFE",
  },
  togglePillDisabled: {
    opacity: 0.6,
  },
  togglePillText: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#4B5563",
  },
  togglePillTextActive: {
    color: "#1D4ED8",
  },
  togglePillTextDisabled: {
    color: "#6B7280",
  },
  rowBetween: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  metaLabel: { fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  metaValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "800",
    color: "#111827",
    textAlign: "right",
  },
  metaValueStrong: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "900",
    color: "#111827",
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 10 },
  totalLabel: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  totalValue: { fontSize: 14, fontWeight: "900", color: "#DC2626" },
  uploadBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#2563EB",
  },
  evidenceGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  evidenceItem: {
    position: "relative",
  },
  evidenceImage: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  removeEvidenceBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "900",
  },
});
