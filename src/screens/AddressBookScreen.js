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
  addMyAddressApi,
  deleteMyAddressApi,
  getMyAddressesApi,
  setDefaultMyAddressApi,
} from "../services/userService";

const EMPTY_FORM = {
  label: "",
  fullName: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  ward: "",
  district: "",
  province: "",
  country: "VN",
  note: "",
};

function AddressCard({ item, onSetDefault, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{item?.fullName || "--"}</Text>
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

      <Text style={styles.meta}>{item?.phone || "--"}</Text>
      {item?.email ? <Text style={styles.meta}>{item.email}</Text> : null}
      <Text style={styles.meta}>{item?.line1 || "--"}</Text>
      {!!item?.line2 ? <Text style={styles.meta}>{item.line2}</Text> : null}
      <Text style={styles.meta}>
        {[item?.ward, item?.district, item?.province].filter(Boolean).join(", ")}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onDelete(item?._id)}>
          <Text style={styles.deleteText}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AddressBookScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    try {
      const data = await getMyAddressesApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tải được địa chỉ";
      Alert.alert("Address", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submit = async () => {
    if (submitting) return;
    if (!form.fullName.trim() || !form.phone.trim() || !form.line1.trim() || !form.district.trim() || !form.province.trim()) {
      Alert.alert("Address", "Vui lòng nhập đủ thông tin: fullName, phone, line1, district, province.");
      return;
    }

    try {
      setSubmitting(true);
      const data = await addMyAddressApi(form);
      setItems(Array.isArray(data) ? data : []);
      setForm(EMPTY_FORM);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tạo được địa chỉ";
      Alert.alert("Address", message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSetDefault = async (addressId) => {
    try {
      const data = await setDefaultMyAddressApi(addressId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không thiết lập lại mặt định được";
      Alert.alert("Address", message);
    }
  };

  const onDelete = async (addressId) => {
    Alert.alert("Address", "Xóa địa chỉ này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await deleteMyAddressApi(addressId);
            setItems(Array.isArray(data) ? data : []);
          } catch (err) {
            const message = err?.response?.data?.message || err?.message || "Không xóa được địa chỉ";
            Alert.alert("Address", message);
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
          <Text style={styles.headerTitle}>Đặt địa chỉ</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Thêm địa chỉ mới</Text>
        <TextInput
          style={styles.input}
          placeholder="Full name *"
          value={form.fullName}
          onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone *"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Address line 1 *"
          value={form.line1}
          onChangeText={(v) => setForm((p) => ({ ...p, line1: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Address line 2"
          value={form.line2}
          onChangeText={(v) => setForm((p) => ({ ...p, line2: v }))}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="Ward"
            value={form.ward}
            onChangeText={(v) => setForm((p) => ({ ...p, ward: v }))}
          />
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="District *"
            value={form.district}
            onChangeText={(v) => setForm((p) => ({ ...p, district: v }))}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Province *"
          value={form.province}
          onChangeText={(v) => setForm((p) => ({ ...p, province: v }))}
        />
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? "Đang lưu..." : "Lưu địa chỉ"}</Text>
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
            <AddressCard item={item} onSetDefault={onSetDefault} onDelete={onDelete} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Chưa có địa chỉ</Text>
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
