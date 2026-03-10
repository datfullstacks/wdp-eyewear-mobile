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
  updateMyAddressApi,
} from "../services/userService";
import { Picker } from "@react-native-picker/picker";
import {
  getProvinces,
  getDistrictsByProvinceCode,
  getWardsByDistrictCode,
} from "vn-provinces";

const EMPTY_FORM = {
  _id: "",
  label: "",
  fullName: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  ward: "",
  wardCode: "",
  district: "",
  districtCode: "",
  province: "",
  provinceCode: "",
  country: "VN",
  note: "",
};

function AddressCard({ item, onSetDefault, onDelete, onEdit }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{item?.fullName || "--"}</Text>
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
        <Text style={styles.metaLabel}>Điện thoại: </Text>
        {item?.phone || "--"}
      </Text>

      {item?.email ? (
        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Email: </Text>
          {item.email}
        </Text>
      ) : null}

      <Text style={styles.meta}>
        <Text style={styles.metaLabel}>Số nhà, tên đường: </Text>
        {item?.line1 || "--"}
      </Text>

      {!!item?.line2 ? (
        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Tòa nhà, tầng, căn hộ: </Text>
          {item.line2}
        </Text>
      ) : null}

      <Text style={styles.meta}>
        <Text style={styles.metaLabel}>Địa chỉ: </Text>
        {[item?.ward, item?.district, item?.province].filter(Boolean).join(", ") || "--"}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onEdit(item)}>
          <Text style={styles.editText}>Sửa</Text>
        </TouchableOpacity>

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
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    setProvinces(getProvinces() || []);
  }, []);

  useEffect(() => {
    if (!form.provinceCode) {
      setDistricts([]);
      setWards([]);
      return;
    }
    setDistricts(getDistrictsByProvinceCode(form.provinceCode) || []);
    setWards([]);
  }, [form.provinceCode]);

  useEffect(() => {
    if (!form.districtCode) {
      setWards([]);
      return;
    }
    setWards(getWardsByDistrictCode(form.districtCode) || []);
  }, [form.districtCode]);

  const loadData = useCallback(async () => {
    try {
      const data = await getMyAddressesApi();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Không tải được địa chỉ";
      Alert.alert("Địa chỉ", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setDistricts([]);
    setWards([]);
    setIsEditing(false);
  };

  const normalizeAddressWithCodes = (addr) => {
    if (!addr) return { ...EMPTY_FORM };

    const provinceList = getProvinces() || [];
    const matchedProvince =
      provinceList.find((p) => String(p.code) === String(addr.provinceCode)) ||
      provinceList.find((p) => p.name === addr.province);

    const districtList = matchedProvince
      ? getDistrictsByProvinceCode(matchedProvince.code) || []
      : [];

    const matchedDistrict =
      districtList.find((d) => String(d.code) === String(addr.districtCode)) ||
      districtList.find((d) => d.name === addr.district);

    const wardList = matchedDistrict
      ? getWardsByDistrictCode(matchedDistrict.code) || []
      : [];

    const matchedWard =
      wardList.find((w) => String(w.code) === String(addr.wardCode)) ||
      wardList.find((w) => w.name === addr.ward);

    return {
      ...EMPTY_FORM,
      ...addr,
      _id: addr?._id || "",
      provinceCode: matchedProvince?.code || addr.provinceCode || "",
      province: matchedProvince?.name || addr.province || "",
      districtCode: matchedDistrict?.code || addr.districtCode || "",
      district: matchedDistrict?.name || addr.district || "",
      wardCode: matchedWard?.code || addr.wardCode || "",
      ward: matchedWard?.name || addr.ward || "",
    };
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (item) => {
    const normalized = normalizeAddressWithCodes(item);
    setForm(normalized);
    setShowForm(true);
    setIsEditing(true);
  };

  const submit = async () => {
    if (submitting) return;

    if (
      !form.fullName.trim() ||
      !form.phone.trim() ||
      !form.line1.trim() ||
      !form.district.trim() ||
      !form.province.trim()
    ) {
      Alert.alert(
        "Địa chỉ",
        "Vui lòng nhập đầy đủ họ tên, số điện thoại, địa chỉ, quận/huyện và tỉnh/thành phố."
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        label: form.label,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        ward: form.ward.trim(),
        wardCode: form.wardCode || "",
        district: form.district.trim(),
        districtCode: form.districtCode || "",
        province: form.province.trim(),
        provinceCode: form.provinceCode || "",
        country: form.country || "VN",
        note: form.note?.trim?.() || "",
      };

      if (isEditing && form._id) {
        await updateMyAddressApi(form._id, payload);
        Alert.alert("Thành công", "Đã cập nhật địa chỉ.");
      } else {
        await addMyAddressApi({
          ...payload,
          isDefault: items.length === 0,
        });
        Alert.alert("Thành công", "Đã thêm địa chỉ mới.");
      }

      await loadData();
      resetForm();
      setShowForm(false);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        (isEditing ? "Không cập nhật được địa chỉ" : "Không tạo được địa chỉ");
      Alert.alert("Địa chỉ", message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSetDefault = async (addressId) => {
    try {
      const data = await setDefaultMyAddressApi(addressId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || "Không thiết lập lại mặc định được";
      Alert.alert("Địa chỉ", message);
    }
  };

  const onDelete = async (addressId) => {
    Alert.alert("Địa chỉ", "Xóa địa chỉ này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await deleteMyAddressApi(addressId);
            setItems(Array.isArray(data) ? data : []);

            if (form._id === addressId) {
              resetForm();
              setShowForm(false);
            }
          } catch (err) {
            const message = err?.response?.data?.message || err?.message || "Không xóa được địa chỉ";
            Alert.alert("Địa chỉ", message);
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
        <Ionicons name={showForm ? "remove-circle-outline" : "add-circle-outline"} size={18} color="#2563EB" />
        <Text style={styles.addNewBtnText}>
          {showForm ? "Ẩn form địa chỉ" : "Thêm địa chỉ mới"}
        </Text>
      </TouchableOpacity>

      {showForm ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{isEditing ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}</Text>

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
            placeholder="Số nhà, tên đường *"
            value={form.line1}
            onChangeText={(v) => setForm((p) => ({ ...p, line1: v }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Tòa nhà, tầng, căn hộ (không bắt buộc)"
            value={form.line2}
            onChangeText={(v) => setForm((p) => ({ ...p, line2: v }))}
          />

          <Text style={styles.pickerLabel}>Tỉnh / Thành phố *</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.provinceCode}
              onValueChange={(value) => {
                if (!value) {
                  setForm((p) => ({
                    ...p,
                    provinceCode: "",
                    province: "",
                    districtCode: "",
                    district: "",
                    wardCode: "",
                    ward: "",
                  }));
                  return;
                }

                const selected = provinces.find((p) => String(p.code) === String(value));
                setForm((prev) => ({
                  ...prev,
                  provinceCode: value,
                  province: selected?.name || "",
                  districtCode: "",
                  district: "",
                  wardCode: "",
                  ward: "",
                }));
              }}
            >
              <Picker.Item label="Chọn tỉnh / thành phố" value="" />
              {provinces.map((p) => (
                <Picker.Item key={String(p.code)} label={p.name} value={p.code} />
              ))}
            </Picker>
          </View>

          <Text style={styles.pickerLabel}>Quận / Huyện *</Text>
          <View style={styles.pickerWrap}>
            <Picker
              enabled={!!form.provinceCode}
              selectedValue={form.districtCode}
              onValueChange={(value) => {
                if (!value) {
                  setForm((p) => ({
                    ...p,
                    districtCode: "",
                    district: "",
                    wardCode: "",
                    ward: "",
                  }));
                  return;
                }

                const selected = districts.find((d) => String(d.code) === String(value));
                setForm((prev) => ({
                  ...prev,
                  districtCode: value,
                  district: selected?.name || "",
                  wardCode: "",
                  ward: "",
                }));
              }}
            >
              <Picker.Item label="Chọn quận / huyện" value="" />
              {districts.map((d) => (
                <Picker.Item key={String(d.code)} label={d.name} value={d.code} />
              ))}
            </Picker>
          </View>

          <Text style={styles.pickerLabel}>Phường / Xã</Text>
          <View style={styles.pickerWrap}>
            <Picker
              enabled={!!form.districtCode}
              selectedValue={form.wardCode}
              onValueChange={(value) => {
                if (!value) {
                  setForm((p) => ({ ...p, wardCode: "", ward: "" }));
                  return;
                }

                const selected = wards.find((w) => String(w.code) === String(value));
                setForm((prev) => ({
                  ...prev,
                  wardCode: value,
                  ward: selected?.name || "",
                }));
              }}
            >
              <Picker.Item label="Chọn phường / xã" value="" />
              {wards.map((w) => (
                <Picker.Item key={String(w.code)} label={w.name} value={w.code} />
              ))}
            </Picker>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.cancelBtn}
              onPress={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={submit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>
                {submitting ? "Đang lưu..." : isEditing ? "Cập nhật" : "Lưu địa chỉ"}
              </Text>
            </TouchableOpacity>
          </View>
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
          <Text style={styles.headerTitle}>Đặt địa chỉ</Text>
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
          renderItem={({ item }) => (
            <AddressCard
              item={item}
              onSetDefault={onSetDefault}
              onDelete={onDelete}
              onEdit={startEdit}
            />
          )}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Chưa có địa chỉ</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  topBlock: {
    paddingBottom: 8,
  },

  addNewBtn: {
    marginBottom: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addNewBtnText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "900",
  },

  formCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 10,
  },

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

  pickerLabel: {
    marginBottom: 6,
    fontSize: 12.5,
    fontWeight: "800",
    color: "#374151",
  },
  pickerWrap: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },

  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: {
    color: "#111827",
    fontWeight: "900",
  },
  submitBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: "900" },

  card: {
    backgroundColor: "#FFFFFF",
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
  cardName: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#111827",
    flex: 1,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
  },
  defaultBadgeText: {
    color: "#15803D",
    fontWeight: "900",
    fontSize: 11,
  },
  linkText: {
    color: "#2563EB",
    fontWeight: "900",
    fontSize: 12,
  },
  meta: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  actions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  editText: {
    color: "#2563EB",
    fontWeight: "900",
    fontSize: 12.5,
  },
  deleteText: {
    color: "#DC2626",
    fontWeight: "900",
    fontSize: 12.5,
  },

  empty: {
    paddingTop: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
  },
  metaLabel: {
  color: "#111827",
  fontWeight: "900",
},
});