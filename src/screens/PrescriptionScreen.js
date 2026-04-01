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
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import {
  addMyPrescriptionApi,
  deleteMyPrescriptionApi,
  getMyPrescriptionsApi,
  setDefaultMyPrescriptionApi,
  updateMyPrescriptionApi,
} from "../services/userService";

const EMPTY_FORM = {
  name: "",
  pd: "",
  note: "",
  rightEye: { sphere: "", cyl: "", axis: "", add: "" },
  leftEye: { sphere: "", cyl: "", axis: "", add: "" },
};

const PALETTE = {
  navy: "#0c2c5c",
  navySoft: "#17365D",
  navyTint: "#EEF3F8",
  gold: "#ddad32",
  goldSoft: "#F5E9C8",
  white: "#FFFFFF",
  bg: "#F7F8FA",
  text: "#162033",
  muted: "#6B7280",
  border: "#E3E8EF",
};

function normalizeFormFromPrescription(item = {}) {
  return {
    name: item?.name || "",
    pd: item?.pd || "",
    note: item?.note || "",
    rightEye: {
      sphere: item?.rightEye?.sphere || "",
      cyl: item?.rightEye?.cyl || "",
      axis: item?.rightEye?.axis || "",
      add: item?.rightEye?.add || "",
    },
    leftEye: {
      sphere: item?.leftEye?.sphere || "",
      cyl: item?.leftEye?.cyl || "",
      axis: item?.leftEye?.axis || "",
      add: item?.leftEye?.add || "",
    },
  };
}

function PrescriptionCard({ item, onSetDefault, onDelete, onEdit }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{item?.name || "--"}</Text>
        {item?.isDefault ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Mặc định</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.85} onPress={() => onSetDefault(item?._id)}>
            <Text style={styles.linkText}>Thiết lập mặc định</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.meta}>
        OD: SPH {item?.rightEye?.sphere || "--"} / CYL {item?.rightEye?.cyl || "--"} / AXIS {item?.rightEye?.axis || "--"} / ADD {item?.rightEye?.add || "--"}
      </Text>
      <Text style={styles.meta}>
        OS: SPH {item?.leftEye?.sphere || "--"} / CYL {item?.leftEye?.cyl || "--"} / AXIS {item?.leftEye?.axis || "--"} / ADD {item?.leftEye?.add || "--"}
      </Text>
      <Text style={styles.meta}>PD: {item?.pd || "--"}</Text>
      {!!item?.note ? <Text style={styles.meta}>Ghi chú: {item.note}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onEdit(item)}
          style={[styles.actionBtn, styles.editBtn]}
        >
          <Feather name="edit" size={16} color={PALETTE.navy} />
          <Text style={styles.linkText}>Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onDelete(item?._id)}
          style={[styles.actionBtn, styles.deleteBtn]}
        >
          <MaterialIcons name="delete-outline" size={18} color="#DC2626" />
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");

  const loadData = useCallback(async () => {
    try {
      const data = await getMyPrescriptionsApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tải được đơn kính";
      Alert.alert("Đơn kính", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingId("");
    setForm(EMPTY_FORM);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const submit = async () => {
    if (submitting) return;
    if (!form.name.trim()) {
      Alert.alert("Đơn kính", "Họ và tên là bắt buộc.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = { ...form };
      const data = editingId
        ? await updateMyPrescriptionApi(editingId, payload)
        : await addMyPrescriptionApi(payload);
      setItems(Array.isArray(data) ? data : []);
      resetForm();
      setShowForm(false);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        (editingId ? "Không cập nhật được đơn kính" : "Không tạo được đơn kính");
      Alert.alert("Đơn kính", message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(String(item?._id || ""));
    setForm(normalizeFormFromPrescription(item));
    setShowForm(true);
  };

  const cancelEdit = () => {
    resetForm();
    setShowForm(false);
  };

  const onSetDefault = async (id) => {
    try {
      const data = await setDefaultMyPrescriptionApi(id);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không thiết lập mặc định được";
      Alert.alert("Đơn kính", message);
    }
  };

  const onDelete = async (id) => {
    Alert.alert("Đơn kính", "Xóa đơn kính này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await deleteMyPrescriptionApi(id);
            setItems(Array.isArray(data) ? data : []);

            if (editingId === String(id)) {
              resetForm();
              setShowForm(false);
            }
          } catch (err) {
            const message = err?.response?.data?.message || err?.message || "Không xóa được đơn kính";
            Alert.alert("Đơn kính", message);
          }
        },
      },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.topBlock}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.addNewBtn}
        onPress={() => {
          if (showForm) {
            resetForm();
            setShowForm(false);
          } else {
            startCreate();
          }
        }}
      >
        <Ionicons
          name={showForm ? "remove-circle-outline" : "add-circle-outline"}
          size={18}
          color={PALETTE.navy}
        />
        <Text style={styles.addNewBtnText}>
          {showForm ? "Ẩn ô nhập đơn kính" : "Thêm đơn kính mới"}
        </Text>
      </TouchableOpacity>

      {showForm ? (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingId ? "Cập nhật đơn kính" : "Thêm đơn kính"}
            </Text>
            {editingId ? (
              <TouchableOpacity activeOpacity={0.85} onPress={cancelEdit}>
                <Text style={styles.linkText}>Hủy sửa</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Họ và tên *"
            placeholderTextColor="#9CA3AF"
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.quarter]}
              placeholder="OD SPH"
              placeholderTextColor="#9CA3AF"
              value={form.rightEye.sphere}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, rightEye: { ...p.rightEye, sphere: v } }))
              }
            />
            <TextInput
              style={[styles.input, styles.quarter]}
              placeholder="OD CYL"
              placeholderTextColor="#9CA3AF"
              value={form.rightEye.cyl}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, rightEye: { ...p.rightEye, cyl: v } }))
              }
            />
            <TextInput
              style={[styles.input, styles.quarter]}
              placeholder="OD AXIS"
              placeholderTextColor="#9CA3AF"
              value={form.rightEye.axis}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, rightEye: { ...p.rightEye, axis: v } }))
              }
            />
            <TextInput
              style={[styles.input, styles.third]}
              placeholder="OD ADD"
              placeholderTextColor="#9CA3AF"
              value={form.rightEye.add}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, rightEye: { ...p.rightEye, add: v } }))
              }
            />
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.quarter]}
              placeholder="OS SPH"
              placeholderTextColor="#9CA3AF"
              value={form.leftEye.sphere}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, leftEye: { ...p.leftEye, sphere: v } }))
              }
            />
            <TextInput
              style={[styles.input, styles.quarter]}
              placeholder="OS CYL"
              placeholderTextColor="#9CA3AF"
              value={form.leftEye.cyl}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, leftEye: { ...p.leftEye, cyl: v } }))
              }
            />
            <TextInput
              style={[styles.input, styles.quarter]}
              placeholder="OS AXIS"
              placeholderTextColor="#9CA3AF"
              value={form.leftEye.axis}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, leftEye: { ...p.leftEye, axis: v } }))
              }
            />
            <TextInput
              style={[styles.input, styles.quarter]}
              placeholder="OS ADD"
              placeholderTextColor="#9CA3AF"
              value={form.leftEye.add}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, leftEye: { ...p.leftEye, add: v } }))
              }
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="PD"
            placeholderTextColor="#9CA3AF"
            value={form.pd}
            onChangeText={(v) => setForm((p) => ({ ...p, pd: v }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Ghi chú"
            placeholderTextColor="#9CA3AF"
            value={form.note}
            onChangeText={(v) => setForm((p) => ({ ...p, note: v }))}
          />

          <Text style={styles.helperText}>
            Điền trực tiếp các thông số đơn kính vào ô nhập rồi lưu.
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={submit}
            disabled={submitting}
          >
            <Ionicons
              name={editingId ? "save-outline" : "checkmark-circle-outline"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.submitText}>
              {submitting
                ? "Đang lưu..."
                : editingId
                  ? "Cập nhật đơn kính"
                  : "Lưu đơn kính"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

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
          <Text style={styles.headerTitle}>Đơn kính của tôi</Text>
        </View>
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
          ListHeaderComponent={renderHeader()}
          renderItem={({ item }) => (
            <PrescriptionCard
              item={item}
              onSetDefault={onSetDefault}
              onDelete={onDelete}
              onEdit={startEdit}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Không có đơn kính</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: PALETTE.text },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  topBlock: { paddingBottom: 8 },
  addNewBtn: {
    marginBottom: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: PALETTE.navyTint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: PALETTE.navy,
  },
  addNewBtnText: {
    color: PALETTE.navy,
    fontSize: 13,
    fontWeight: "900",
  },
  formCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: PALETTE.white,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  formTitle: { fontSize: 13, fontWeight: "900", color: PALETTE.text },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.text,
    backgroundColor: PALETTE.white,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  third: { flex: 1 },
  quarter: { flex: 1 },
  helperText: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 10,
    backgroundColor: PALETTE.navy,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: "900" },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardName: { fontSize: 13.5, fontWeight: "900", color: PALETTE.text, flex: 1 },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
  },
  defaultBadgeText: { color: "#15803D", fontWeight: "900", fontSize: 11 },
  linkText: { color: PALETTE.navy, fontWeight: "900", fontSize: 12 },
  meta: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: PALETTE.muted },
  actions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  actionBtn: {
    minWidth: 84,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
  },
  editBtn: {
    backgroundColor: PALETTE.navyTint,
    borderColor: PALETTE.border,
  },
  deleteBtn: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  deleteText: { color: "#DC2626", fontWeight: "900", fontSize: 12.5 },
  empty: { paddingTop: 20, alignItems: "center" },
  emptyText: { color: PALETTE.muted, fontWeight: "700" },
});
