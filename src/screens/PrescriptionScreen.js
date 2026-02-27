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
  addMyPrescriptionApi,
  deleteMyPrescriptionApi,
  getMyPrescriptionsApi,
  setDefaultMyPrescriptionApi,
} from "../services/userService";

const EMPTY_FORM = {
  name: "",
  pd: "",
  note: "",
  rightEye: { sphere: "", cyl: "", axis: "" },
  leftEye: { sphere: "", cyl: "", axis: "" },
};

function PrescriptionCard({ item, onSetDefault, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{item?.name || "--"}</Text>
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

      <Text style={styles.meta}>OD: SPH {item?.rightEye?.sphere || "--"} / CYL {item?.rightEye?.cyl || "--"} / AXIS {item?.rightEye?.axis || "--"}</Text>
      <Text style={styles.meta}>OS: SPH {item?.leftEye?.sphere || "--"} / CYL {item?.leftEye?.cyl || "--"} / AXIS {item?.leftEye?.axis || "--"}</Text>
      <Text style={styles.meta}>PD: {item?.pd || "--"}</Text>
      {!!item?.note ? <Text style={styles.meta}>Ghi chú: {item.note}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onDelete(item?._id)}>
          <Text style={styles.deleteText}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PrescriptionScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    try {
      const data = await getMyPrescriptionsApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tải được prescription";
      Alert.alert("Prescription", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submit = async () => {
    if (submitting) return;
    if (!form.name.trim()) {
      Alert.alert("Prescription", "Name is required.");
      return;
    }

    try {
      setSubmitting(true);
      const data = await addMyPrescriptionApi(form);
      setItems(Array.isArray(data) ? data : []);
      setForm(EMPTY_FORM);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tạo được prescription";
      Alert.alert("Prescription", message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSetDefault = async (id) => {
    try {
      const data = await setDefaultMyPrescriptionApi(id);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không thiết lập mặt định được";
      Alert.alert("Prescription", message);
    }
  };

  const onDelete = async (id) => {
    Alert.alert("Prescription", "Xóa prescription này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await deleteMyPrescriptionApi(id);
            setItems(Array.isArray(data) ? data : []);
          } catch (err) {
            const message = err?.response?.data?.message || err?.message || "Khong xoa duoc prescription";
            Alert.alert("Prescription", message);
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
          <Text style={styles.headerTitle}>Prescription của tôi</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Thêm prescription</Text>
        <TextInput
          style={styles.input}
          placeholder="Name *"
          value={form.name}
          onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.third]}
            placeholder="OD SPH"
            value={form.rightEye.sphere}
            onChangeText={(v) =>
              setForm((p) => ({ ...p, rightEye: { ...p.rightEye, sphere: v } }))
            }
          />
          <TextInput
            style={[styles.input, styles.third]}
            placeholder="OD CYL"
            value={form.rightEye.cyl}
            onChangeText={(v) =>
              setForm((p) => ({ ...p, rightEye: { ...p.rightEye, cyl: v } }))
            }
          />
          <TextInput
            style={[styles.input, styles.third]}
            placeholder="OD AXIS"
            value={form.rightEye.axis}
            onChangeText={(v) =>
              setForm((p) => ({ ...p, rightEye: { ...p.rightEye, axis: v } }))
            }
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.third]}
            placeholder="OS SPH"
            value={form.leftEye.sphere}
            onChangeText={(v) =>
              setForm((p) => ({ ...p, leftEye: { ...p.leftEye, sphere: v } }))
            }
          />
          <TextInput
            style={[styles.input, styles.third]}
            placeholder="OS CYL"
            value={form.leftEye.cyl}
            onChangeText={(v) =>
              setForm((p) => ({ ...p, leftEye: { ...p.leftEye, cyl: v } }))
            }
          />
          <TextInput
            style={[styles.input, styles.third]}
            placeholder="OS AXIS"
            value={form.leftEye.axis}
            onChangeText={(v) =>
              setForm((p) => ({ ...p, leftEye: { ...p.leftEye, axis: v } }))
            }
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="PD"
          value={form.pd}
          onChangeText={(v) => setForm((p) => ({ ...p, pd: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Note"
          value={form.note}
          onChangeText={(v) => setForm((p) => ({ ...p, note: v }))}
        />
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? "Đang lưu..." : "Lưu prescription"}</Text>
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
            <PrescriptionCard item={item} onSetDefault={onSetDefault} onDelete={onDelete} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Không có prescription</Text>
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
  third: { flex: 1 },
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
