import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CART_TYPES, useCartStore } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";
import {
  buildCheckoutPayload,
  buildCheckoutItems,
  fetchCheckoutQuote,
  createCheckout,
} from "../services/checkoutService";
import { addMyAddressApi, getMyAddressesApi } from "../services/userService";
import { validatePromotionApi } from "../services/promotionService";
import { Ionicons } from "@expo/vector-icons";

const SHIPPING_METHODS = [
  { id: "standard", label: "Giao tiêu chuẩn", eta: "2-4 ngày làm việc", price: 25000 },
  { id: "express", label: "Giao nhanh", eta: "1-2 ngày làm việc", price: 45000 },
];

const PAYMENT_METHODS = [
  { id: "sepay", label: "SePay (QR)", desc: "Quét QR SePay để thanh toán" },
];

const PREORDER_PAYMENT_METHODS = PAYMENT_METHODS;
const API_CART_TYPE = {
  [CART_TYPES.ORDER]: "ready_stock",
  [CART_TYPES.PREORDER]: "pre_order",
};

const formatVND = (value) => new Intl.NumberFormat("vi-VN").format(value) + "đ";
const pickValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};
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
  const line2 = [addr.line2, addr.ward, addr.district, addr.province].filter(Boolean).join(", ");
  if (line2) lines.push(line2);
  const country = addr.country || "VN";
  if (country) lines.push(country === "VN" ? "Việt Nam" : country);
  return lines;
};

export default function CheckoutScreen({ navigation, route }) {
  const initialQuote = route?.params?.quote || null;
  const initialQuoteMeta = route?.params?.quoteMeta || {};

  // ✅ hidden note from cart pairing (NOT shown on UI)
  const autoNote = String(initialQuoteMeta.autoNote || "").trim();

  const [shippingId, setShippingId] = useState(initialQuoteMeta.shippingMethod || "standard");
  const [paymentId, setPaymentId] = useState(PAYMENT_METHODS[0]?.id || "sepay");

  // ✅ user note only (UI)
  const [userNote, setUserNote] = useState("");
  const [voucherInput, setVoucherInput] = useState(String(initialQuoteMeta.voucherCode || ""));
  const [appliedVoucherCode, setAppliedVoucherCode] = useState(
    String(initialQuoteMeta.voucherCode || "").trim()
  );
  const [voucherMeta, setVoucherMeta] = useState(initialQuoteMeta.voucher || null);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);

  const items = useCartStore((s) => s.items);
  const preorderItems = useCartStore((s) => s.preorderItems);
  const cartType =
    route?.params?.quoteMeta?.cartType === CART_TYPES.PREORDER ? CART_TYPES.PREORDER : CART_TYPES.ORDER;
  const cartItems = cartType === CART_TYPES.PREORDER ? preorderItems : items;

  const isHydrating = useCartStore((s) => s.isHydrating);
  const hydrate = useCartStore((s) => s.hydrate);
  const token = useAuthStore((s) => s.token);

  const [address, setAddress] = useState(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [draftAddress, setDraftAddress] = useState(EMPTY_ADDRESS);

  const [quote, setQuote] = useState(initialQuote);
  const [skipInitialQuote, setSkipInitialQuote] = useState(Boolean(initialQuote));
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  const quoteErrorMessage = useMemo(() => {
    const data = quoteError?.response?.data || {};
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map((e) => e.msg).filter(Boolean).join("\n");
    }
    return data.message || data.error || quoteError?.message || null;
  }, [quoteError]);

  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce((sum, it) => {
        const payRate = it?.isPreorder ? 0.3 : 1;
        return sum + (it.product?.price || 0) * (it.qty || 0) * payRate;
      }, 0),
    [cartItems]
  );

  const hasPreorder = useMemo(() => cartItems.some((it) => Boolean(it?.isPreorder)), [cartItems]);
  const paymentMethods = PAYMENT_METHODS;

  const shippingMethodFee = useMemo(() => {
    const found = SHIPPING_METHODS.find((m) => m.id === shippingId);
    return found ? found.price : 0;
  }, [shippingId]);

  const cartDiscountAmount = initialQuoteMeta.discountAmount;

  const checkoutItems = useMemo(() => {
    const built = buildCheckoutItems(cartItems);
    return built.map((it, idx) => {
      const ci = cartItems[idx];
      return {
        ...it,
        isPreorder: Boolean(ci?.isPreorder),
        payRate: ci?.isPreorder ? 0.3 : 1,
      };
    });
  }, [cartItems]);

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
    if (!token) return;
    let active = true;
    setAddressLoading(true);

    getMyAddressesApi()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        const defaultAddress = list.find((a) => a?.isDefault) || list[0] || null;
        if (defaultAddress) {
          setAddress({
            fullName: defaultAddress.fullName || "",
            phone: defaultAddress.phone || "",
            email: defaultAddress.email || "",
            line1: defaultAddress.line1 || "",
            line2: defaultAddress.line2 || "",
            ward: defaultAddress.ward || "",
            district: defaultAddress.district || "",
            province: defaultAddress.province || "",
            country: defaultAddress.country || "VN",
            note: defaultAddress.note || "",
          });
        }
      })
      .catch(() => { })
      .finally(() => {
        if (!active) return;
        setAddressLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

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

  const saveEditAddress = async () => {
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
      cleaned.fullName || cleaned.phone || cleaned.line1 || cleaned.ward || cleaned.district || cleaned.province
    );
    if (!hasValue) {
      setAddress(null);
      setIsEditingAddress(false);
      return;
    }

    try {
      if (token) {
        const updated = await addMyAddressApi(cleaned);
        const list = Array.isArray(updated) ? updated : [];
        const selected = list.find((a) => a?.isDefault) || list[list.length - 1] || cleaned;
        setAddress({
          fullName: selected.fullName || "",
          phone: selected.phone || "",
          email: selected.email || "",
          line1: selected.line1 || "",
          line2: selected.line2 || "",
          ward: selected.ward || "",
          district: selected.district || "",
          province: selected.province || "",
          country: selected.country || "VN",
          note: selected.note || "",
        });
      } else {
        setAddress(cleaned);
      }
      setIsEditingAddress(false);
    } catch (err) {
      const data = err?.response?.data || {};
      const message = data.message || data.error || err?.message || "Không lưu được địa chỉ";
      Alert.alert("Địa chỉ", message);
    }
  };

  const hasAddress = Boolean(
    address?.fullName || address?.phone || address?.line1 || address?.ward || address?.district || address?.province
  );
  const addressComplete = Boolean(
    address?.fullName && address?.phone && address?.line1 && address?.ward && address?.district && address?.province
  );

  // ✅ quote update (do NOT include autoNote / userNote in quote)
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
      voucherCode: appliedVoucherCode || undefined,
      cartType: API_CART_TYPE[cartType] || "ready_stock",
      // note intentionally omitted
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
  }, [
    checkoutItems,
    shippingId,
    addressComplete,
    address,
    skipInitialQuote,
    cartDiscountAmount,
    shippingMethodFee,
    appliedVoucherCode,
    cartType,
  ]);

  const applyVoucher = async () => {
    if (isApplyingVoucher) return;
    const code = String(voucherInput || "").trim().toUpperCase();
    if (!code) {
      setAppliedVoucherCode("");
      setVoucherMeta(null);
      return;
    }

    if (!checkoutItems.length) {
      Alert.alert("Giỏ hàng trống", "Không thể áp mã khi chưa có sản phẩm.");
      return;
    }

    try {
      setIsApplyingVoucher(true);

      const validatePayload = {
        voucherCode: code,
        items: checkoutItems,
        shippingFee: shippingMethodFee,
        shippingMethod: shippingId,
        cartType: API_CART_TYPE[cartType] || "ready_stock",
      };

      const validated = await validatePromotionApi(validatePayload);
      if (!validated?.valid) {
        throw new Error(validated?.message || "Voucher không hợp lệ.");
      }

      setAppliedVoucherCode(code);
      setVoucherMeta(validated?.voucher || null);

      const quotePayload = buildCheckoutPayload({
        items: checkoutItems,
        shippingMethod: shippingId,
        shippingFee: shippingMethodFee,
        shippingAddress: addressComplete ? address : null,
        voucherCode: code,
        cartType: API_CART_TYPE[cartType] || "ready_stock",
      });
      const refreshedQuote = await fetchCheckoutQuote(quotePayload);
      setQuote(refreshedQuote);
      setQuoteError(null);
      setSkipInitialQuote(false);
      Alert.alert("Áp mã thành công", `Đã áp dụng voucher ${code}.`);
    } catch (err) {
      const data = err?.response?.data || {};
      const errors = Array.isArray(data?.errors)
        ? data.errors.map((e) => e?.msg).filter(Boolean).join("\n")
        : null;
      const message = errors || data?.message || data?.error || err?.message;
      Alert.alert("Không áp dụng được voucher", message || "Vui lòng thử mã khác.");
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const checkoutOrder = async () => {
    if (isSubmitting || !checkoutItems.length) return;
    if (!addressComplete) {
      Alert.alert("Thiếu địa chỉ", "Vui lòng nhập đầy đủ thông tin giao hàng.");
      return;
    }

    // ✅ merge hidden auto note + user note (user note appended)
    const mergedNote = [autoNote, String(userNote || "").trim()].filter(Boolean).join("\n");

    try {
      setIsSubmitting(true);
      const payload = buildCheckoutPayload({
        items: checkoutItems,
        shippingMethod: shippingId,
        shippingAddress: addressComplete ? address : null,
        note: mergedNote || undefined, // ✅ only send if any
        shippingFee: shippingMethodFee,
        discountAmount: typeof cartDiscountAmount === "number" ? cartDiscountAmount : undefined,
        voucherCode: appliedVoucherCode || undefined,
        cartType: API_CART_TYPE[cartType] || "ready_stock",
        paymentMethod: paymentId || "sepay",
      });

      const data = await createCheckout(payload);
      const now = new Date().toISOString();
      const orderId = data?.orderId || data?.id || `OD${Date.now().toString().slice(-6)}`;
      const breakdown = data?.breakdown || data || {};
      const serverPayment = data?.payment || data?.paymentInstructions || data?.paymentInstruction || {};
      const fallbackMethod = "SEPAY";
      const fallbackStatus = "PENDING_QR";
      const orderPayment = {
        ...serverPayment,
        method:
          pickValue(
            serverPayment.method,
            serverPayment.paymentMethod,
            data?.paymentMethod,
            data?.method
          ) || fallbackMethod,
        status:
          pickValue(
            serverPayment.status,
            serverPayment.paymentStatus,
            data?.paymentStatus,
            data?.status
          ) || fallbackStatus,
        paymentCode:
          pickValue(
            serverPayment.paymentCode,
            serverPayment.code,
            data?.paymentCode,
            data?.code
          ) || null,
        content:
          pickValue(
            serverPayment.content,
            serverPayment.description,
            data?.content,
            serverPayment.paymentCode,
            data?.paymentCode
          ) || null,
        bankAccountId:
          pickValue(
            serverPayment.bankAccountId,
            serverPayment.bank_account_id,
            data?.bankAccountId,
            data?.bank_account_id
          ) || null,
        bankAccountNumber:
          pickValue(
            serverPayment.bankAccountNumber,
            serverPayment.bank_account_number,
            data?.bankAccountNumber,
            data?.bank_account_number,
            serverPayment.bankAccountId,
            data?.bankAccountId
          ) || null,
        bankName:
          pickValue(
            serverPayment.bankName,
            serverPayment.bank_name,
            data?.bankName,
            data?.bank_name
          ) || null,
        bankAccountName:
          pickValue(
            serverPayment.bankAccountName,
            serverPayment.bank_account_name,
            data?.bankAccountName,
            data?.bank_account_name
          ) || null,
        qrUrl:
          pickValue(
            serverPayment.qrUrl,
            serverPayment.qr_url,
            data?.qrUrl,
            data?.qr_url
          ) || null,
        paymentUrl:
          pickValue(
            serverPayment.paymentUrl,
            serverPayment.payment_url,
            serverPayment.checkoutUrl,
            data?.paymentUrl,
            data?.payment_url
          ) || null,
        createdAt: pickValue(serverPayment.createdAt, data?.createdAt, now) || now,
        paidAt: pickValue(serverPayment.paidAt, data?.paidAt, null),
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
        voucherCode: appliedVoucherCode || null,
        payment: {
          ...orderPayment,
        },
        shippingAddress: address,
        items: checkoutItems.map((it) => ({
          name: cartItems.find((x) => x.product?.id === it.productId)?.product?.name || "Sản phẩm",
          qty: it.quantity,
          price: cartItems.find((x) => x.product?.id === it.productId)?.product?.price || 0,
          preorder: Boolean(it.isPreorder),
        })),
      };

      console.log("Note:", mergedNote);
      navigation.navigate("CheckoutStatus", { order: orderPayload, cartType });
    } catch (err) {
      const data = err?.response?.data || {};
      const errors = Array.isArray(data.errors)
        ? data.errors.map((e) => e.msg).filter(Boolean).join("\n")
        : null;
      const message = errors || data.message || data.error || err?.message;
      Alert.alert("Thanh toán thất bại", message || "Không thể tạo đơn hàng. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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

          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
              <TouchableOpacity activeOpacity={0.85} disabled={isEditingAddress} onPress={() => startEditAddress(address)}>
                <Text style={[styles.linkText, isEditingAddress && styles.linkDisabled]}>
                  {isEditingAddress ? "Đang chỉnh sửa" : hasAddress ? "Thay đổi" : "Thêm"}
                </Text>
              </TouchableOpacity>
            </View>
            {addressLoading ? <Text style={styles.addressMeta}>Đang tải địa chỉ...</Text> : null}

            {isEditingAddress ? (
              <View style={styles.addressForm}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Họ và tên</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập họ và tên"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.fullName}
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, fullName: value }))}
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
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, phone: value }))}
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
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, email: value }))}
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
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, line1: value }))}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Bổ sung (line 2)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Hầm/tầng/phòng (tuỳ chọn)"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.line2}
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, line2: value }))}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Phường / Xã</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập phường/xã"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.ward}
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, ward: value }))}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Quận / Huyện</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập quận/huyện"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.district}
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, district: value }))}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tỉnh / Thành phố</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập tỉnh/thành phố"
                    placeholderTextColor="#9CA3AF"
                    value={draftAddress.province}
                    onChangeText={(value) => setDraftAddress((prev) => ({ ...prev, province: value }))}
                  />
                </View>

                <View style={styles.addressActions}>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} activeOpacity={0.85} onPress={cancelEditAddress}>
                    <Text style={[styles.actionText, styles.actionTextGhost]}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} activeOpacity={0.85} onPress={saveEditAddress}>
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

                <TouchableOpacity activeOpacity={0.9} style={styles.addAddressBtn} onPress={() => startEditAddress(EMPTY_ADDRESS)}>
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
            {hasPreorder ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Đơn có sản phẩm đặt trước, thời gian giao dự kiến tính sau khi có hàng.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>

            <View style={styles.radioList}>
              {(() => {
                const activeMethod = paymentMethods.find((m) => m.id === paymentId) || paymentMethods[0];
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
            <Text style={styles.sectionTitle}>Mã giảm giá</Text>
            <View style={styles.voucherRow}>
              <TextInput
                style={styles.voucherInput}
                value={voucherInput}
                onChangeText={setVoucherInput}
                placeholder="Nhập voucher"
                autoCapitalize="characters"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.voucherBtn, isApplyingVoucher && styles.voucherBtnDisabled]}
                disabled={isApplyingVoucher}
                onPress={applyVoucher}
              >
                <Text style={styles.voucherBtnText}>{isApplyingVoucher ? "Đang áp..." : "Áp dụng"}</Text>
              </TouchableOpacity>
            </View>
            {appliedVoucherCode ? (
              <Text style={styles.voucherHint}>
                Đã áp dụng: {appliedVoucherCode}
                {voucherMeta?.type ? ` (${voucherMeta.type})` : ""}
              </Text>
            ) : null}
          </View>

          {/* ✅ UI note: user only */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ghi chú đơn hàng (không bắt buộc)</Text>
            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="VD: Hãy cẩn thận khi giao hàng..."
              placeholderTextColor="#9CA3AF"
              value={userNote}
              onChangeText={setUserNote}
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

            {quoteLoading ? <Text style={styles.quoteHint}>Đang cập nhật giá...</Text> : null}
            {quoteError ? (
              <Text style={styles.quoteError}>{quoteErrorMessage || "Không lấy được báo giá mới."}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.continueBtn, (isSubmitting || !addressComplete) && styles.continueBtnDisabled]}
            onPress={checkoutOrder}
            disabled={isSubmitting || !checkoutItems.length}
          >
            <Text style={styles.continueText}>{isSubmitting ? "Đang tạo đơn..." : "Tiếp tục"}</Text>
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  header: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },

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
  voucherRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  voucherInput: {
    flex: 1,
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
  voucherBtn: {
    height: 44,
    minWidth: 88,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  voucherBtnDisabled: { opacity: 0.7 },
  voucherBtnText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" },
  voucherHint: { marginTop: 8, fontSize: 12, fontWeight: "700", color: "#15803D" },

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