import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCartStore } from "../store/cartStore";
import {
  buildCheckoutPayload,
  buildCheckoutItems,
  fetchCheckoutQuote,
  createCheckout,
} from "../services/checkoutService";

const SHIPPING_METHODS = [
  {
    id: "standard",
    label: "Giao tiêu chuẩn",
    eta: "2-4 ngày làm việc",
    price: 25000,
  },
  {
    id: "express",
    label: "Giao nhanh",
    eta: "1-2 ngày làm việc",
    price: 45000,
  },
];

const PAYMENT_METHODS = [
  {
    id: "sepay",
    label: "SePay (QR)",
    desc: "Quét QR SePay để thanh toán",
  },
];

const PREORDER_PAYMENT_METHODS = PAYMENT_METHODS;

const formatVND = (value) => new Intl.NumberFormat("vi-VN").format(value) + "đ";
const EMPTY_ADDRESS = {
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

const buildAddressLines = (addr) => {
  if (!addr) return [];
  const lines = [];
  if (addr.line1) lines.push(addr.line1);
  const line2 = [addr.line2, addr.ward, addr.district, addr.province]
    .filter(Boolean)
    .join(", ");
  if (line2) lines.push(line2);
  const country = addr.country || "VN";
  if (country) lines.push(country === "VN" ? "Việt Nam" : country);
  return lines;
};

export default function CheckoutScreen({ navigation, route }) {
  const initialQuote = route?.params?.quote || null;
  const initialQuoteMeta = route?.params?.quoteMeta || {};
  const [shippingId, setShippingId] = useState(initialQuoteMeta.shippingMethod || "standard");
  const [paymentId, setPaymentId] = useState("cod");
  const [note, setNote] = useState("");
  const items = useCartStore((s) => s.items);
  const isHydrating = useCartStore((s) => s.isHydrating);
  const hydrate = useCartStore((s) => s.hydrate);

  const [address, setAddress] = useState(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [draftAddress, setDraftAddress] = useState(EMPTY_ADDRESS);

  const [quote, setQuote] = useState(initialQuote);
  const [skipInitialQuote, setSkipInitialQuote] = useState(Boolean(initialQuote));
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quoteErrorMessage = useMemo(() => {
    const data = quoteError?.response?.data || {};
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map((e) => e.msg).filter(Boolean).join("\n");
    }
    return data.message || data.error || quoteError?.message || null;
  }, [quoteError]);

  const cartSubtotal = useMemo(
    () => items.reduce((sum, it) => sum + (it.product?.price || 0) * (it.qty || 0), 0),
    [items]
  );

  const hasPreorder = useMemo(() => items.some((it) => it.orderType === "PREORDER"), [items]);
  const paymentMethods = PAYMENT_METHODS;

  const shippingMethodFee = useMemo(() => {
    const found = SHIPPING_METHODS.find((m) => m.id === shippingId);
    return found ? found.price : 0;
  }, [shippingId]);
  const cartDiscountAmount = initialQuoteMeta.discountAmount;

  const checkoutItems = useMemo(() => buildCheckoutItems(items), [items]);

  const subtotal = quote?.subtotal ?? cartSubtotal;
  const discount = quote?.discountAmount ?? 0;
  const shipping = quote?.shippingFee ?? shippingMethodFee;
  const total = quote?.total ?? Math.max(0, subtotal - discount + shipping);
  const payNow = quote?.payNow ?? total;
  const payLater = quote?.payLater ?? Math.max(0, total - payNow);

  useEffect(() => {
    if (isHydrating) hydrate();
  }, [isHydrating, hydrate]);

  useEffect(() => {
    if (!paymentMethods.find((m) => m.id === paymentId)) {
      setPaymentId(paymentMethods[0]?.id || "cod");
    }
  }, [paymentMethods, paymentId]);

  const startEditAddress = (preset) => {
    setDraftAddress(preset ?? address ?? EMPTY_ADDRESS);
    setIsEditingAddress(true);
  };

  const cancelEditAddress = () => {
    setDraftAddress(address ?? EMPTY_ADDRESS);
    setIsEditingAddress(false);
  };

  const saveEditAddress = () => {
    const cleaned = {
      fullName: draftAddress.fullName.trim(),
      phone: draftAddress.phone.trim(),
      email: draftAddress.email.trim(),
      line1: draftAddress.line1.trim(),
      line2: draftAddress.line2.trim(),
      ward: draftAddress.ward.trim(),
      district: draftAddress.district.trim(),
      province: draftAddress.province.trim(),
      country: draftAddress.country?.trim() || "VN",
      note: draftAddress.note.trim(),
    };
    const hasValue = Boolean(
      cleaned.fullName ||
        cleaned.phone ||
        cleaned.line1 ||
        cleaned.ward ||
        cleaned.district ||
        cleaned.province
    );
    setAddress(hasValue ? cleaned : null);
    setIsEditingAddress(false);
  };

  const hasAddress = Boolean(
    address?.fullName ||
      address?.phone ||
      address?.line1 ||
      address?.ward ||
      address?.district ||
      address?.province
  );
  const addressComplete = Boolean(
    address?.fullName &&
      address?.phone &&
      address?.line1 &&
      address?.ward &&
      address?.district &&
      address?.province
  );

  useEffect(() => {
    let active = true;
    if (!checkoutItems.length) {
      setQuote(null);
      return undefined;
    }

    if (skipInitialQuote) {
      setSkipInitialQuote(false);
      return undefined;
    }

    const payload = buildCheckoutPayload({
      items: checkoutItems,
      shippingMethod: shippingId,
      shippingFee: shippingMethodFee,
      discountAmount: typeof cartDiscountAmount === "number" ? cartDiscountAmount : undefined,
      shippingAddress: addressComplete ? address : null,
    });

    setQuoteLoading(true);
    setQuoteError(null);

    fetchCheckoutQuote(payload)
      .then((data) => {
        if (!active) return;
        setQuote(data);
      })
      .catch((err) => {
        if (!active) return;
        console.warn("checkout quote failed", err?.response?.data || err?.message || err);
        setQuoteError(err);
        setQuote(null);
      })
      .finally(() => {
        if (!active) return;
        setQuoteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [checkoutItems, shippingId, addressComplete, address, skipInitialQuote, cartDiscountAmount, shippingMethodFee]);

  const checkoutOrder = async () => {
    if (isSubmitting || !checkoutItems.length) return;
    if (!addressComplete) {
      Alert.alert("Thiếu địa chỉ", "Vui lòng nhập đầy đủ thông tin giao hàng.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = buildCheckoutPayload({
        items: checkoutItems,
        shippingMethod: shippingId,
        shippingAddress: addressComplete ? address : null,
        note: note?.trim() || undefined,
        shippingFee: shippingMethodFee,
        discountAmount: typeof cartDiscountAmount === "number" ? cartDiscountAmount : undefined,
        paymentMethod: "sepay",
      });

      const data = await createCheckout(payload);
      const now = new Date().toISOString();
      const orderId = data?.orderId || data?.id || `OD${Date.now().toString().slice(-6)}`;
      const breakdown = data?.breakdown || data || {};
      const serverPayment = data?.payment || {};
      const fallbackMethod = "SEPAY";
      const fallbackStatus = "PENDING_QR";
      const orderPayment = {
        ...serverPayment,
        method: serverPayment.method || fallbackMethod,
        status: serverPayment.status || fallbackStatus,
        createdAt: serverPayment.createdAt || now,
        paidAt: serverPayment.paidAt || null,
      };
      const orderPayload = {
        orderId,
        createdAt: now,
        status: "CONFIRMED",
        breakdown: {
          subtotal: breakdown.subtotal ?? subtotal,
          shippingFee: breakdown.shippingFee ?? shipping,
          discountAmount: breakdown.discountAmount ?? discount,
          total: breakdown.total ?? total,
          payNow: breakdown.payNow ?? payNow,
          payLater: breakdown.payLater ?? payLater,
        },
        payment: {
          ...orderPayment,
        },
        shippingAddress: address,
        items: checkoutItems.map((it) => ({
          name: items.find((x) => x.product?.id === it.productId)?.product?.name || "Sản phẩm",
          qty: it.quantity,
          price: items.find((x) => x.product?.id === it.productId)?.product?.price || 0,
          preorder: it.orderType === "PREORDER",
        })),
      };

      navigation.navigate("CheckoutStatus", { order: orderPayload });
    } catch (err) {
      const data = err?.response?.data || {};
      const errors = Array.isArray(data.errors)
        ? data.errors.map((e) => e.msg).filter(Boolean).join("\n")
        : null;
      const message = errors || data.message || data.error || err?.message;
      Alert.alert(
        "Thanh toán thất bại",
        message || "Không thể tạo đơn hàng. Vui lòng thử lại."
      );
    } finally {
      setIsSubmitting(false);
    }
  };
    return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Thanh toán</Text>
            <Text style={styles.headerStep}>1/2 Giao hàng</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={isEditingAddress}
                onPress={() => startEditAddress(address)}
              >
                <Text style={[styles.linkText, isEditingAddress && styles.linkDisabled]}>
                  {isEditingAddress ? "Đang chỉnh sửa" : hasAddress ? "Thay đổi" : "Thêm"}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditingAddress ? (
              <View style={styles.addressForm}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Họ và tên</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập họ và tên"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.fullName}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, fullName: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Số điện thoại</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập số điện thoại"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    value={draftAddress.phone}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, phone: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email (tuỳ chọn)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={draftAddress.email}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, email: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Địa chỉ (line 1)</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputMultiline]}
                    placeholder="Số nhà, tên đường..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                    value={draftAddress.line1}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, line1: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Bổ sung (line 2)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Hẻm/tầng/phòng (tuỳ chọn)"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.line2}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, line2: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Phường / Xã</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập phường/xã"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.ward}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, ward: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Quận / Huyện</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập quận/huyện"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.district}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, district: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tỉnh / Thành phố</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập tỉnh/thành phố"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.province}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, province: value }))
                    }
                  />
                </View>

                <View style={styles.addressActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnGhost]}
                    activeOpacity={0.85}
                    onPress={cancelEditAddress}
                  >
                    <Text style={[styles.actionText, styles.actionTextGhost]}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    activeOpacity={0.85}
                    onPress={saveEditAddress}
                  >
                    <Text style={[styles.actionText, styles.actionTextPrimary]}>Lưu</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {hasAddress ? (
                  <>
                    <Text style={styles.addressName}>{address.fullName || "--"}</Text>
                    <Text style={styles.addressMeta}>{address.phone || "--"}</Text>
                    {address.email ? <Text style={styles.addressMeta}>{address.email}</Text> : null}
                    {buildAddressLines(address).map((line, idx) => (
                      <Text key={`${line}-${idx}`} style={styles.addressMeta}>
                        {line}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={styles.addressEmpty}>Chưa có địa chỉ giao hàng</Text>
                )}

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.addAddressBtn}
                  onPress={() => startEditAddress(EMPTY_ADDRESS)}
                >
                  <Text style={styles.addAddressText}>+ Thêm địa chỉ</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phương thức giao hàng</Text>

            <View style={styles.radioList}>
              {SHIPPING_METHODS.map((m) => {
                const active = m.id === shippingId;
                return (
                  <TouchableOpacity
                    key={m.id}
                    activeOpacity={0.85}
                    style={[styles.radioItem, active && styles.radioItemActive]}
                    onPress={() => setShippingId(m.id)}
                  >
                    <View style={[styles.radioDot, active && styles.radioDotActive]}>
                      {active && <View style={styles.radioDotInner} />}
                    </View>
                    <View style={styles.radioInfo}>
                      <View style={styles.radioRow}>
                        <Text style={styles.radioLabel}>{m.label}</Text>
                        <Text style={styles.radioPrice}>{formatVND(m.price)}</Text>
                      </View>
                      <Text style={styles.radioEta}>{m.eta}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                Đơn có sản phẩm đặt trước, thời gian giao dự kiến tính sau khi có hàng.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>

            <View style={styles.radioList}>
              {(() => {
                const activeMethod =
                  paymentMethods.find((m) => m.id === paymentId) || paymentMethods[0];
                if (!activeMethod) return null;
                return (
                  <View style={[styles.radioItem, styles.radioItemActive]}>
                    <View style={[styles.radioDot, styles.radioDotActive]}>
                      <View style={styles.radioDotInner} />
                    </View>
                    <View style={styles.radioInfo}>
                      <View style={styles.radioRow}>
                        <Text style={styles.radioLabel}>{activeMethod.label}</Text>
                      </View>
                      <Text style={styles.radioEta}>{activeMethod.desc}</Text>
                    </View>
                  </View>
                );
              })()}
            </View>

            {hasPreorder ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Đơn đặt trước cần đặt cọc qua SePay, phần còn lại thanh toán khi nhận hàng.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ghi chú đơn hàng (không bắt buộc)</Text>
            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="Ghi chú cho cửa hàng"
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính</Text>
              <Text style={styles.summaryValue}>{formatVND(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
              <Text style={styles.summaryValue}>{formatVND(shipping)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm giá</Text>
              <Text style={styles.summaryValue}>-{formatVND(discount)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Tổng cộng</Text>
              <Text style={styles.summaryTotalValue}>{formatVND(total)}</Text>
            </View>
            {hasPreorder ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Trả trước (SePay)</Text>
                  <Text style={styles.summaryValue}>{formatVND(payNow)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Còn lại (COD)</Text>
                  <Text style={styles.summaryValue}>{formatVND(payLater)}</Text>
                </View>
              </>
            ) : null}
            {quoteLoading ? <Text style={styles.quoteHint}>Đang cập nhật giá…</Text> : null}
            {quoteError ? (
              <Text style={styles.quoteError}>
                {quoteErrorMessage || "Không lấy được báo giá mới."}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.continueBtn,
              (isSubmitting || !addressComplete) && styles.continueBtnDisabled,
            ]}
            onPress={checkoutOrder}
            disabled={isSubmitting || !checkoutItems.length}
          >
            <Text style={styles.continueText}>
              {isSubmitting ? "Đang tạo đơn..." : "Tiếp tục"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },

  header: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  headerStep: { fontSize: 13, fontWeight: "800", color: "#2563EB" },

  card: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  linkText: { fontSize: 12.5, fontWeight: "800", color: "#2563EB" },
  linkDisabled: { color: "#9CA3AF" },

  addressName: { marginTop: 10, fontSize: 14, fontWeight: "900", color: "#111827" },
  addressMeta: { marginTop: 6, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  addressEmpty: { marginTop: 10, fontSize: 12.5, fontWeight: "700", color: "#9CA3AF" },

  addressForm: { marginTop: 10, gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12.5, fontWeight: "800", color: "#6B7280" },
  fieldInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  fieldInputMultiline: {
    height: 90,
    paddingTop: 10,
    paddingBottom: 10,
  },

  addressActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnGhost: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionBtnPrimary: { backgroundColor: "#2563EB" },
  actionText: { fontSize: 13, fontWeight: "900" },
  actionTextGhost: { color: "#111827" },
  actionTextPrimary: { color: "#FFFFFF" },

  addAddressBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#E9F1FF",
  },
  addAddressText: { fontSize: 12.5, fontWeight: "800", color: "#2563EB" },

  radioList: { marginTop: 10, gap: 10 },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  radioItemActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotActive: { borderColor: "#2563EB" },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  radioInfo: { flex: 1, marginLeft: 10 },
  radioRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  radioLabel: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  radioPrice: { fontSize: 13, fontWeight: "900", color: "#111827" },
  radioEta: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },

  noticeBox: {
    marginTop: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 10,
  },
  noticeText: { fontSize: 12.5, fontWeight: "700", color: "#6B7280" },

  noteInput: {
    marginTop: 10,
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 13, fontWeight: "800", color: "#6B7280" },
  summaryValue: { fontSize: 13, fontWeight: "900", color: "#111827" },
  summaryDivider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 8 },
  summaryTotalLabel: { fontSize: 14, fontWeight: "900", color: "#111827" },
  summaryTotalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },
  quoteHint: { marginTop: 8, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  quoteError: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#B91C1C" },

  continueBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
});
