import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

const EMPTY_FORM = {
  label: "",
  type: "card",
  provider: "",
  maskedNumber: "",
  holderName: "",
  expMonth: "",
  expYear: "",
};

function PaymentCard({ item, onSetDefault, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{item?.label || "--"}</Text>
        {item?.isDefault ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.85} onPress={() => onSetDefault(item?._id)}>
            <Text style={styles.linkText}>Set default</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.meta}>{item?.provider || "--"} - {item?.maskedNumber || "--"}</Text>
      {!!item?.holderName ? <Text style={styles.meta}>{item.holderName}</Text> : null}
      <Text style={styles.meta}>
        {item?.type || "card"} {item?.expMonth ? `| ${item.expMonth}/${item.expYear || ""}` : ""}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onDelete(item?._id)}>
          <Text style={styles.deleteText}>Delete</Text>
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

  const loadData = useCallback(async () => {
    try {
      const data = await getMyPaymentMethodsApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Khong tai duoc payment methods";
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
    if (!form.label.trim() || !form.maskedNumber.trim()) {
      Alert.alert("Payments", "Vui long nhap label va maskedNumber.");
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
      const message = err?.response?.data?.message || err?.message || "Khong tao duoc payment method";
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
      const message = err?.response?.data?.message || err?.message || "Khong set duoc default";
      Alert.alert("Payments", message);
    }
  };

  const onDelete = async (id) => {
    Alert.alert("Payments", "Xoa payment method nay?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await deleteMyPaymentMethodApi(id);
            setItems(Array.isArray(data) ? data : []);
          } catch (err) {
            const message = err?.response?.data?.message || err?.message || "Khong xoa duoc payment method";
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
          <Text style={styles.headerTitle}>Payments</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add payment method</Text>
        <TextInput
          style={styles.input}
          placeholder="Label *"
          value={form.label}
          onChangeText={(v) => setForm((p) => ({ ...p, label: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Provider"
          value={form.provider}
          onChangeText={(v) => setForm((p) => ({ ...p, provider: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Masked number * (e.g. ****1234)"
          value={form.maskedNumber}
          onChangeText={(v) => setForm((p) => ({ ...p, maskedNumber: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Holder name"
          value={form.holderName}
          onChangeText={(v) => setForm((p) => ({ ...p, holderName: v }))}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="Exp month"
            keyboardType="numeric"
            value={form.expMonth}
            onChangeText={(v) => setForm((p) => ({ ...p, expMonth: v }))}
          />
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="Exp year"
            keyboardType="numeric"
            value={form.expYear}
            onChangeText={(v) => setForm((p) => ({ ...p, expYear: v }))}
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? "Saving..." : "Save payment method"}</Text>
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
              <Text style={styles.emptyText}>No payment method yet</Text>
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
  meta: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  actions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },
  deleteText: { color: "#DC2626", fontWeight: "900", fontSize: 12.5 },
  empty: { paddingTop: 20, alignItems: "center" },
  emptyText: { color: "#6B7280", fontWeight: "700" },
});
