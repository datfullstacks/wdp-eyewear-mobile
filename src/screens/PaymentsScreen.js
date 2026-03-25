import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  addMyPaymentMethodApi,
  deleteMyPaymentMethodApi,
  getMyPaymentMethodsApi,
  setDefaultMyPaymentMethodApi,
} from "../services/userService";
import {
  findRefundBankByCode,
  findRefundBankByName,
  getRefundBankLogo,
  isRefundAccountNumberFormatValid,
  normalizeRefundAccountNumber,
  REFUND_BANK_OPTIONS,
} from "../data/refundBanks";

const PAYMENT_TYPE_OPTIONS = [
  { value: "card", label: "Thẻ ngân hàng" },
  { value: "bank_account", label: "Tài khoản ngân hàng" },
];

const EMPTY_FORM = {
  label: "",
  type: "card",
  provider: "",
  maskedNumber: "",
  holderName: "",
  expMonth: "",
  expYear: "",
  bankName: "",
  bankCode: "",
  accountNumber: "",
};

function maskBankNumber(value = "") {
  const normalized = normalizeRefundAccountNumber(value);
  if (!normalized) return "";
  const last4 = normalized.slice(-4);
  return `****${last4}`;
}

function BankLogo({ bank, size = 20 }) {
  const logo = getRefundBankLogo(bank);
  const displayName = bank?.name || bank?.code || "BANK";
  const label = bank?.code || bank?.name?.slice(0, 3)?.toUpperCase() || "BANK";
  const width = Math.max(size * 1.8, Math.min(96, displayName.length * (size < 20 ? 4.8 : 5.6)));

  if (logo) {
    return (
      <Image
        source={logo}
        style={[styles.bankLogo, { width, height: size }]}
        resizeMode="contain"
      />
    );
  }

  return (
    <View
      style={[
        styles.bankLogoFallback,
        { width, height: size, borderRadius: 6 },
      ]}
    >
      <Text style={styles.bankLogoFallbackText}>{label.slice(0, 3)}</Text>
    </View>
  );
}

function formatTypeLabel(type) {
  if (type === "bank_account") return "Tài khoản ngân hàng";
  return "Thẻ ngân hàng";
}

function PaymentCard({ item, onSetDefault, onDelete }) {
  const isBankAccount = item?.type === "bank_account";
  const bank =
    findRefundBankByCode(item?.bankCode) ||
    findRefundBankByName(item?.bankName) ||
    findRefundBankByName(item?.provider);
  const providerText = item?.bankName || item?.provider || "--";
  const numberText = item?.maskedNumber || maskBankNumber(item?.accountNumber) || item?.accountMask || "--";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{item?.label || "--"}</Text>
        {item?.isDefault ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Mặt định</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.85} onPress={() => onSetDefault(item?._id)}>
            <Text style={styles.linkText}>Thiết lập mặt định</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bankMetaRow}>
        {isBankAccount ? (
          <BankLogo bank={bank || { code: item?.bankCode, name: providerText }} size={26} />
        ) : null}
        <Text style={styles.metaStrong}>{providerText} - {numberText}</Text>
      </View>
      {!!item?.holderName ? <Text style={styles.meta}>{item.holderName}</Text> : null}
      <Text style={styles.meta}>
        {formatTypeLabel(item?.type)}
        {!isBankAccount && item?.expMonth ? ` | ${item.expMonth}/${item.expYear || ""}` : ""}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onDelete(item?._id)}>
          <Text style={styles.deleteText}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PaymentsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const isBankAccount = form.type === "bank_account";
  const bankSuggestions = useMemo(() => REFUND_BANK_OPTIONS.slice(0, 8), []);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const changeType = (type) => {
    setForm((prev) => ({
      ...EMPTY_FORM,
      label: prev.label,
      holderName: prev.holderName,
      type,
    }));
  };

  const loadData = useCallback(async () => {
    try {
      const data = await getMyPaymentMethodsApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tải được phương thức thanh toán";
      Alert.alert("Payments", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submit = async () => {
    if (submitting) return;

    if (!form.label.trim()) {
      Alert.alert("Payments", "Vui lòng nhập tên phương thức thanh toán.");
      return;
    }

    if (!form.holderName.trim()) {
      Alert.alert("Payments", "Vui lòng nhập tên chủ tài khoản hoặc chủ thẻ.");
      return;
    }

    if (isBankAccount) {
      const normalizedAccountNumber = normalizeRefundAccountNumber(form.accountNumber);
      const matchedBank =
        findRefundBankByCode(form.bankCode) ||
        findRefundBankByName(form.bankName) ||
        findRefundBankByName(form.provider);

      if (!matchedBank && !form.bankName.trim() && !form.provider.trim()) {
        Alert.alert("Payments", "Vui lòng nhập tên ngân hàng.");
        return;
      }

      if (!isRefundAccountNumberFormatValid(normalizedAccountNumber)) {
        Alert.alert("Payments", "Số tài khoản phải có từ 8 đến 19 chữ số.");
        return;
      }

      try {
        setSubmitting(true);
        const payload = {
          ...form,
          type: "bank_account",
          bankCode: matchedBank?.code || form.bankCode.trim().toUpperCase(),
          bankName: matchedBank?.name || form.bankName.trim() || form.provider.trim(),
          provider: matchedBank?.name || form.bankName.trim() || form.provider.trim(),
          accountNumber: normalizedAccountNumber,
          maskedNumber: maskBankNumber(normalizedAccountNumber),
          expMonth: undefined,
          expYear: undefined,
        };
        const data = await addMyPaymentMethodApi(payload);
        setItems(Array.isArray(data) ? data : []);
        setForm(EMPTY_FORM);
      } catch (err) {
        const message = err?.response?.data?.message || err?.message || "Không tạo được phương thức thanh toán";
        Alert.alert("Payments", message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!form.maskedNumber.trim()) {
      Alert.alert("Payments", "Vui lòng nhập số thẻ hoặc số đã che.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        expMonth: form.expMonth ? Number(form.expMonth) : undefined,
        expYear: form.expYear ? Number(form.expYear) : undefined,
      };
      const data = await addMyPaymentMethodApi(payload);
      setItems(Array.isArray(data) ? data : []);
      setForm(EMPTY_FORM);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tạo được phương thức thanh toán";
      Alert.alert("Payments", message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSetDefault = async (id) => {
    try {
      const data = await setDefaultMyPaymentMethodApi(id);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không thiết lập mặt định được";
      Alert.alert("Payments", message);
    }
  };

  const onDelete = async (id) => {
    Alert.alert("Payments", "Xóa phương thức thanh toán này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await deleteMyPaymentMethodApi(id);
            setItems(Array.isArray(data) ? data : []);
          } catch (err) {
            const message = err?.response?.data?.message || err?.message || "Không xóa được phương thức thanh toán";
            Alert.alert("Payments", message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
            activeOpacity={0.85}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Thêm phương thức thanh toán</Text>

        <View style={styles.segmentWrap}>
          {PAYMENT_TYPE_OPTIONS.map((option) => {
            const active = form.type === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => changeType(option.value)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Tên hiển thị *"
          value={form.label}
          onChangeText={(v) => updateForm("label", v)}
        />

        {isBankAccount ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Tên ngân hàng *"
              value={form.bankName}
              onChangeText={(v) => {
                updateForm("bankName", v);
                updateForm("provider", v);
              }}
            />

            <View style={styles.suggestionWrap}>
              {bankSuggestions.map((bank) => (
                <Pressable
                  key={bank.code}
                  style={styles.suggestionChip}
                  onPress={() =>
                    setForm((prev) => ({
                      ...prev,
                      bankCode: bank.code,
                      bankName: bank.name,
                      provider: bank.name,
                    }))
                  }
                >
                  <BankLogo bank={bank} size={38} />
                  <Text style={styles.suggestionText}>{bank.name}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Số tài khoản *"
              keyboardType="numeric"
              value={form.accountNumber}
              onChangeText={(v) => updateForm("accountNumber", normalizeRefundAccountNumber(v))}
            />
            <TextInput
              style={styles.input}
              placeholder="Tên chủ tài khoản *"
              value={form.holderName}
              onChangeText={(v) => updateForm("holderName", v)}
            />
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Ngân hàng / Provider"
              value={form.provider}
              onChangeText={(v) => updateForm("provider", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Số thẻ đã che * (vd: ****1234)"
              value={form.maskedNumber}
              onChangeText={(v) => updateForm("maskedNumber", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Tên chủ thẻ *"
              value={form.holderName}
              onChangeText={(v) => updateForm("holderName", v)}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.half]}
                placeholder="Tháng hết hạn"
                keyboardType="numeric"
                value={form.expMonth}
                onChangeText={(v) => updateForm("expMonth", v)}
              />
              <TextInput
                style={[styles.input, styles.half]}
                placeholder="Năm hết hạn"
                keyboardType="numeric"
                value={form.expYear}
                onChangeText={(v) => updateForm("expYear", v)}
              />
            </View>
          </>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? "Đang lưu..." : "Lưu phương thức thanh toán"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item?._id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PaymentCard item={item} onSetDefault={onSetDefault} onDelete={onDelete} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Không có phương thức thanh toán</Text>
            </View>
          }
        />
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
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  formCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  formTitle: { fontSize: 13, fontWeight: "900", color: "#111827", marginBottom: 10 },
  segmentWrap: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#2563EB",
  },
  segmentText: { fontSize: 12.5, fontWeight: "800", color: "#6B7280" },
  segmentTextActive: { color: "#1D4ED8" },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  suggestionText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
  },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  submitBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: "900" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardName: { fontSize: 13.5, fontWeight: "900", color: "#111827", flex: 1 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#ECFDF5" },
  defaultBadgeText: { color: "#15803D", fontWeight: "900", fontSize: 11 },
  linkText: { color: "#2563EB", fontWeight: "900", fontSize: 12 },
  bankMetaRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  bankLogo: {
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  bankLogoFallback: {
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  bankLogoFallbackText: {
    fontSize: 8.5,
    fontWeight: "900",
    color: "#374151",
  },
  metaStrong: { fontSize: 12.5, fontWeight: "800", color: "#374151", flex: 1 },
  meta: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  actions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },
  deleteText: { color: "#DC2626", fontWeight: "900", fontSize: 12.5 },
  empty: { paddingTop: 20, alignItems: "center" },
  emptyText: { color: "#6B7280", fontWeight: "700" },
});
