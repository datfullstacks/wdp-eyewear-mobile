import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CART_TYPES } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";
import { useStoreNetworkStore } from "../store/storeNetworkStore";
import { useSystemConfigStore } from "../store/systemConfigStore";
import {
  buildCheckoutPayload,
  buildCheckoutItems,
  fetchCheckoutQuote,
  createCheckout,
} from "../services/checkoutService";
import { getOrderByIdApi } from "../services/orderService";
import {
  addMyAddressApi,
  getMyAddressesApi,
  updateMyAddressApi,
  setDefaultMyAddressApi,
} from "../services/userService";
import {
  getDistrictsApi,
  getProvincesApi,
  getWardsApi,
} from "../services/locationService";
import { validatePromotionApi } from "../services/promotionService";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

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

const SHIPPING_METHODS = [
  {
    id: "standard",
    label: "Giao tiêu chuẩn",
    fallbackEta: "2-4 ngày làm việc",
  },
  {
    id: "express",
    label: "Giao nhanh",
    fallbackEta: "1-2 ngày làm việc",
  },
];

const PAYMENT_METHODS = [
  { id: "sepay", label: "SePay (QR)", desc: "Quét QR SePay để thanh toán" },
  { id: "cod", label: "COD", desc: "Thanh toán khi nhận hàng" },
];

const API_CART_TYPE = {
  [CART_TYPES.ORDER]: "ready_stock",
  [CART_TYPES.PREORDER]: "pre_order",
};

const formatVND = (value) => new Intl.NumberFormat("vi-VN").format(value) + "đ";

const extractApiErrorMessage = (error) => {
  const data = error?.response?.data || {};
  const errors = Array.isArray(data?.errors)
    ? data.errors
      .map((item) => item?.msg)
      .filter(Boolean)
      .join("\n")
    : "";

  return errors || data?.message || data?.error || error?.message || "";
};

const normalizePercent = (value, fallback = 100) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(100, number);
};

const getCartItemDepositPercent = (item) =>
  normalizePercent(
    item?.depositPercent ??
    item?.preOrderConfig?.depositPercent ??
    item?.product?.preOrder?.depositPercent,
    item?.isPreorder ? 100 : 100,
  );

const getCartItemPayNow = (item) => {
  if (Number.isFinite(Number(item?.payNow))) {
    return Math.max(0, Number(item.payNow));
  }
  const unitPrice = Number(item?.product?.price || item?.unitPrice || 0);
  const quantity = Number(item?.qty || item?.quantity || 0);
  const lineTotal = unitPrice * quantity;
  return Math.round(lineTotal * (getCartItemDepositPercent(item) / 100));
};

const getCartItemPayLater = (item) => {
  if (Number.isFinite(Number(item?.payLater))) {
    return Math.max(0, Number(item.payLater));
  }
  const unitPrice = Number(item?.product?.price || item?.unitPrice || 0);
  const quantity = Number(item?.qty || item?.quantity || 0);
  const lineTotal = unitPrice * quantity;
  return Math.max(0, lineTotal - getCartItemPayNow(item));
};

const getShippingCollectionTimingLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "with_balance") return "Thu khi giao hàng";
  if (normalized === "on_delivery") return "Thu khi giao hàng";
  return "Thu ngay";
};

const getShippingFeeModeLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "estimated" ? "Tạm tính" : "Giá thanh toán";
};

const formatShippingLeadtime = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `Dự kiến ${date.toLocaleDateString("vi-VN")}`;
};

const EMPTY_ADDRESS = {
  _id: "",
  fullName: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  ward: "",
  wardCode: "",
  district: "",
  districtId: "",
  province: "",
  provinceId: "",
  country: "VN",
  note: "",
  isDefault: false,
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

const normalizeAddressRecord = (raw = {}) => ({
  _id: raw._id || "",
  fullName: raw.fullName || "",
  phone: raw.phone || "",
  email: raw.email || "",
  line1: raw.line1 || "",
  line2: raw.line2 || "",
  ward: raw.ward || "",
  wardCode: raw.wardCode || "",
  district: raw.district || "",
  districtId: raw.districtId ? String(raw.districtId) : "",
  province: raw.province || "",
  provinceId: raw.provinceId ? String(raw.provinceId) : "",
  country: raw.country || "VN",
  note: raw.note || "",
  isDefault: Boolean(raw.isDefault),
});

const hasLocationIds = (addr) =>
  Boolean(
    addr?.provinceId &&
    addr?.districtId &&
    addr?.wardCode &&
    String(addr.provinceId).trim() &&
    String(addr.districtId).trim() &&
    String(addr.wardCode).trim(),
  );

export default function CheckoutScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialQuote = route?.params?.quote || null;
  const initialCartItems = Array.isArray(route?.params?.cartItems)
    ? route.params.cartItems
    : [];
  const initialCheckoutItems = Array.isArray(route?.params?.checkoutItems)
    ? route.params.checkoutItems
    : [];
  const initialQuoteMeta = route?.params?.quoteMeta || {};

  const autoNote = String(initialQuoteMeta.autoNote || "").trim();

  const [shippingId, setShippingId] = useState(
    initialQuoteMeta.shippingMethod || "standard",
  );
  const [paymentId, setPaymentId] = useState(PAYMENT_METHODS[0]?.id || "sepay");

  const [userNote, setUserNote] = useState("");
  const [voucherInput, setVoucherInput] = useState(
    String(initialQuoteMeta.voucherCode || ""),
  );
  const [appliedVoucherCode, setAppliedVoucherCode] = useState(
    String(initialQuoteMeta.voucherCode || "").trim(),
  );
  const [voucherMeta, setVoucherMeta] = useState(
    initialQuoteMeta.voucher || null,
  );
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);

  const cartType =
    route?.params?.quoteMeta?.cartType === CART_TYPES.PREORDER
      ? CART_TYPES.PREORDER
      : CART_TYPES.ORDER;
  const cartItems = initialCartItems;
  const token = useAuthStore((s) => s.token);
  const selectedStoreId = useStoreNetworkStore((s) => s.selectedStoreId);
  const preorderRuntimeEnabled = useSystemConfigStore(
    (s) => s.config?.featureFlags?.preorderEnabled !== false,
  );
  const codRuntimeEnabled = useSystemConfigStore(
    (s) => s.config?.payments?.codEnabled !== false,
  );
  const refreshSystemConfig = useSystemConfigStore((s) => s.refresh);

  const [address, setAddress] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [draftAddress, setDraftAddress] = useState({ ...EMPTY_ADDRESS });

  const [quote, setQuote] = useState(initialQuote);
  const [skipInitialQuote, setSkipInitialQuote] = useState(
    Boolean(initialQuote),
  );
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const quoteErrorMessage = useMemo(() => {
    const data = quoteError?.response?.data || {};
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors
        .map((e) => e.msg)
        .filter(Boolean)
        .join("\n");
    }
    return data.message || data.error || quoteError?.message || null;
  }, [quoteError]);

  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce((sum, it) => {
        return sum + getCartItemPayNow(it);
      }, 0),
    [cartItems],
  );
  const cartPayLaterSubtotal = useMemo(
    () =>
      cartItems.reduce((sum, it) => {
        return sum + getCartItemPayLater(it);
      }, 0),
    [cartItems],
  );

  const hasPreorder = useMemo(
    () => cartItems.some((it) => Boolean(it?.isPreorder)),
    [cartItems],
  );


  const paymentMethods = useMemo(() => {
    return PAYMENT_METHODS.filter((method) => {
      if (method.id === "cod" && !codRuntimeEnabled) return false;
      if (hasPreorder && method.id === "cod") return false;
      return true;
    });
  }, [codRuntimeEnabled, hasPreorder]);
  const cartDiscountAmount = initialQuoteMeta.discountAmount;

  const checkoutItems = useMemo(() => {
    const built = initialCheckoutItems.length
      ? buildCheckoutItems(initialCheckoutItems)
      : buildCheckoutItems(cartItems);
    return built.map((it) => ({ ...it }));
  }, [cartItems, initialCheckoutItems]);

  const subtotal = quote?.subtotal ?? cartSubtotal;
  const discount = quote?.discountAmount ?? 0;
  const shippingOptions = quote?.shippingOptions || null;

  const shippingMethods = useMemo(
    () =>
      SHIPPING_METHODS.map((method) => {
        const option = shippingOptions?.[method.id] || null;
        return {
          ...method,
          available: option ? option.available !== false : true,
          fee: typeof option?.fee === "number" ? option.fee : null,
          eta: formatShippingLeadtime(option?.leadtime, method.fallbackEta),
          message: option?.message || null,
        };
      }),
    [shippingOptions],
  );

  const selectedShippingOption = shippingOptions?.[shippingId] || null;
  const shipping = quote?.shippingFee ?? selectedShippingOption?.fee ?? 0;
  const total =
    quote?.total ??
    Math.max(0, cartSubtotal + cartPayLaterSubtotal - discount + shipping);
  const payNow = quote?.payNow ?? Math.max(0, cartSubtotal - discount + shipping);
  const payLater = quote?.payLater ?? Math.max(0, cartPayLaterSubtotal);
  const shippingCollectionTiming = quote?.shippingCollectionTiming ?? "upfront";
  const shippingFeeMode = quote?.shippingFeeMode ?? "estimated";
  const payNowMethod = String(quote?.payNowMethod || "sepay").toUpperCase();
  const payLaterMethod = payLater > 0
    ? String(quote?.payLaterMethod || "cod").toUpperCase()
    : null;

  useEffect(() => {
    let active = true;

    getProvincesApi()
      .then((data) => {
        if (!active) return;
        setProvinces(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setProvinces([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setAddressLoading(true);

    getMyAddressesApi()
      .then(async (data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        const normalizedList = list.map(normalizeAddressRecord);
        const defaultAddress =
          normalizedList.find((a) => a?.isDefault) || normalizedList[0] || null;

        setSavedAddresses(normalizedList);

        if (defaultAddress) {
          const resolvedDefault = hasLocationIds(defaultAddress)
            ? defaultAddress
            : await hydrateAddressDraft(defaultAddress);
          if (!active) return;
          setAddress(resolvedDefault);
        } else {
          setAddress(null);
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
    void refreshSystemConfig().catch(() => { });
  }, [refreshSystemConfig]);

  useEffect(() => {
    if (cartType === CART_TYPES.PREORDER && !preorderRuntimeEnabled) {
      Alert.alert("Đặt trước đang tắt", "Admin đang tắt chức năng đặt hàng trước trong cấu hình hệ thống.", [
        {
          text: "Quay lại giỏ hàng",
          onPress: () => {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          },
        },
      ]);
    }
  }, [cartType, navigation, preorderRuntimeEnabled]);

  useEffect(() => {
    if (!paymentMethods.find((m) => m.id === paymentId)) {
      setPaymentId(paymentMethods[0]?.id || "sepay");
    }
  }, [paymentMethods, paymentId]);

  useEffect(() => {
    if (!draftAddress.provinceId) {
      setDistricts([]);
      setWards([]);
      return;
    }

    let active = true;
    getDistrictsApi(draftAddress.provinceId)
      .then((data) => {
        if (!active) return;
        setDistricts(Array.isArray(data) ? data : []);
        setWards([]);
      })
      .catch(() => {
        if (!active) return;
        setDistricts([]);
        setWards([]);
      });

    return () => {
      active = false;
    };
  }, [draftAddress.provinceId]);

  useEffect(() => {
    if (!draftAddress.districtId) {
      setWards([]);
      return;
    }

    let active = true;
    getWardsApi(draftAddress.districtId)
      .then((data) => {
        if (!active) return;
        setWards(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setWards([]);
      });

    return () => {
      active = false;
    };
  }, [draftAddress.districtId]);

  const hydrateAddressDraft = async (addr) => {
    if (!addr) return { ...EMPTY_ADDRESS };

    try {
      const provinceList = Array.isArray(provinces) && provinces.length > 0
        ? provinces
        : await getProvincesApi();
      const safeProvinceList = Array.isArray(provinceList) ? provinceList : [];
      const matchedProvince =
        safeProvinceList.find((p) => String(p.id) === String(addr.provinceId)) ||
        safeProvinceList.find((p) => p.name === addr.province);

      const districtList = matchedProvince?.id
        ? await getDistrictsApi(matchedProvince.id)
        : [];
      const safeDistrictList = Array.isArray(districtList) ? districtList : [];

      const matchedDistrict =
        safeDistrictList.find((d) => String(d.id) === String(addr.districtId)) ||
        safeDistrictList.find((d) => d.name === addr.district);

      const wardList = matchedDistrict?.id
        ? await getWardsApi(matchedDistrict.id)
        : [];
      const safeWardList = Array.isArray(wardList) ? wardList : [];

      const matchedWard =
        safeWardList.find((w) => String(w.code) === String(addr.wardCode)) ||
        safeWardList.find((w) => w.name === addr.ward);

      setDistricts(safeDistrictList);
      setWards(safeWardList);

      return {
        ...EMPTY_ADDRESS,
        ...addr,
        _id: addr?._id || "",
        isDefault: Boolean(addr?.isDefault),
        provinceId: matchedProvince?.id || String(addr.provinceId || ""),
        province: matchedProvince?.name || addr.province || "",
        districtId: matchedDistrict?.id || String(addr.districtId || ""),
        district: matchedDistrict?.name || addr.district || "",
        wardCode: matchedWard?.code || addr.wardCode || "",
        ward: matchedWard?.name || addr.ward || "",
      };
    } catch {
      setDistricts([]);
      setWards([]);

      return {
        ...EMPTY_ADDRESS,
        ...addr,
        _id: addr?._id || "",
        isDefault: Boolean(addr?.isDefault),
        provinceId: addr?.provinceId ? String(addr.provinceId) : "",
        districtId: addr?.districtId ? String(addr.districtId) : "",
        wardCode: addr?.wardCode || "",
      };
    }
  };

  const resolveAddressForCheckout = async (addr) => {
    const normalized = normalizeAddressRecord(addr);
    if (!normalized?._id && !normalized.fullName && !normalized.line1) {
      return normalized;
    }

    if (hasLocationIds(normalized)) {
      return normalized;
    }

    try {
      return await hydrateAddressDraft(normalized);
    } catch {
      return normalized;
    }
  };

  const getDefaultAddressFromList = (list, fallback = null) => {
    const safeList = (Array.isArray(list) ? list : []).map(
      normalizeAddressRecord,
    );
    const defaultAddress =
      safeList.find((a) => a?.isDefault) || safeList[0] || fallback || null;

    if (!defaultAddress) return null;

    return normalizeAddressRecord(defaultAddress);
  };

  const refreshAndSelectDefaultAddress = async (fallbackAddress = null) => {
    const refreshed = await getMyAddressesApi();
    const normalizedList = (Array.isArray(refreshed) ? refreshed : []).map(
      normalizeAddressRecord,
    );
    setSavedAddresses(normalizedList);
    const selected = getDefaultAddressFromList(refreshed, fallbackAddress);
    setAddress(selected);
    return selected;
  };

  const chooseSavedAddress = async (nextAddress) => {
    const normalized = await resolveAddressForCheckout(nextAddress);
    setAddress(normalized);
    setDraftAddress({
      ...EMPTY_ADDRESS,
      ...normalized,
    });
  };

  const startEditAddress = async (preset) => {
    setIsEditingAddress(true);

    try {
      const nextDraft = await hydrateAddressDraft(
        preset ?? address ?? { ...EMPTY_ADDRESS },
      );
      setDraftAddress(nextDraft);
    } catch {
      setDraftAddress({
        ...EMPTY_ADDRESS,
        ...(preset ?? address ?? {}),
      });
    }
  };

  const cancelEditAddress = () => {
    setDraftAddress({
      ...EMPTY_ADDRESS,
      ...(address ?? {}),
      provinceId: address?.provinceId ? String(address.provinceId) : "",
      districtId: address?.districtId ? String(address.districtId) : "",
    });
    setIsEditingAddress(false);
  };

  const saveEditAddress = async () => {
    const cleaned = {
      _id: draftAddress._id || "",
      fullName: draftAddress.fullName.trim(),
      phone: draftAddress.phone.trim(),
      email: draftAddress.email.trim(),
      line1: draftAddress.line1.trim(),
      line2: draftAddress.line2.trim(),
      ward: draftAddress.ward.trim(),
      wardCode: draftAddress.wardCode || "",
      district: draftAddress.district.trim(),
      districtId: draftAddress.districtId
        ? Number(draftAddress.districtId)
        : undefined,
      province: draftAddress.province.trim(),
      provinceId: draftAddress.provinceId
        ? Number(draftAddress.provinceId)
        : undefined,
      country: draftAddress.country?.trim() || "VN",
      note: draftAddress.note.trim(),
    };

    const hasValue = Boolean(
      cleaned.fullName ||
      cleaned.phone ||
      cleaned.line1 ||
      cleaned.ward ||
      cleaned.district ||
      cleaned.province,
    );

    if (!hasValue) {
      setAddress(null);
      setSavedAddresses([]);
      setIsEditingAddress(false);
      return;
    }

    if (
      !cleaned.fullName ||
      !cleaned.phone ||
      !cleaned.line1 ||
      !cleaned.ward ||
      !cleaned.wardCode ||
      !cleaned.district ||
      !cleaned.districtId ||
      !cleaned.province ||
      !cleaned.provinceId
    ) {
      Alert.alert(
        "Địa chỉ",
        "Vui lòng nhập đầy đủ họ tên, số điện thoại, địa chỉ và chọn tỉnh/thành phố, quận/huyện, phường/xã hợp lệ.",
      );
      return;
    }

    try {
      if (token) {
        const isEditingExisting = Boolean(cleaned._id);

        const response = isEditingExisting
          ? await updateMyAddressApi(cleaned._id, cleaned)
          : await addMyAddressApi(cleaned);

        const list = Array.isArray(response) ? response : [];

        let selected =
          (isEditingExisting
            ? list.find((a) => String(a?._id) === String(cleaned._id))
            : list.find(
              (a) =>
                a?.fullName === cleaned.fullName &&
                a?.phone === cleaned.phone &&
                a?.line1 === cleaned.line1 &&
                a?.district === cleaned.district &&
                a?.province === cleaned.province,
            )) ||
          list[list.length - 1] ||
          cleaned;

        const selectedId = selected?._id || cleaned._id;

        if (selectedId) {
          await setDefaultMyAddressApi(selectedId);
        }

        const selectedFallback = {
          _id: selectedId || "",
          fullName: selected.fullName || cleaned.fullName,
          phone: selected.phone || cleaned.phone,
          email: selected.email || cleaned.email,
          line1: selected.line1 || cleaned.line1,
          line2: selected.line2 || cleaned.line2,
          ward: selected.ward || cleaned.ward,
          wardCode: selected.wardCode || cleaned.wardCode,
          district: selected.district || cleaned.district,
          districtId: selected.districtId
            ? String(selected.districtId)
            : String(cleaned.districtId || ""),
          province: selected.province || cleaned.province,
          provinceId: selected.provinceId
            ? String(selected.provinceId)
            : String(cleaned.provinceId || ""),
          country: selected.country || cleaned.country || "VN",
          note: selected.note || cleaned.note,
          isDefault: true,
        };

        const nextAddress =
          await refreshAndSelectDefaultAddress(selectedFallback);

        setDraftAddress({
          ...EMPTY_ADDRESS,
          ...(nextAddress || selectedFallback),
          provinceId: (nextAddress || selectedFallback)?.provinceId
            ? String((nextAddress || selectedFallback).provinceId)
            : "",
          districtId: (nextAddress || selectedFallback)?.districtId
            ? String((nextAddress || selectedFallback).districtId)
            : "",
        });
      } else {
        const localAddress = normalizeAddressRecord({
          ...cleaned,
          isDefault: true,
        });
        setAddress(localAddress);
        setSavedAddresses([localAddress]);
        setDraftAddress({
          ...EMPTY_ADDRESS,
          ...localAddress,
          provinceId: localAddress?.provinceId
            ? String(localAddress.provinceId)
            : "",
          districtId: localAddress?.districtId
            ? String(localAddress.districtId)
            : "",
        });
      }

      setIsEditingAddress(false);
    } catch (err) {
      const data = err?.response?.data || {};
      const message =
        data.message || data.error || err?.message || "Không lưu được địa chỉ";
      Alert.alert("Địa chỉ", message);
    }
  };

  const hasAddress = Boolean(
    address?.fullName ||
    address?.phone ||
    address?.line1 ||
    address?.ward ||
    address?.district ||
    address?.province,
  );

  const addressComplete = Boolean(
    address?.fullName &&
    address?.phone &&
    address?.line1 &&
    address?.ward &&
    address?.wardCode &&
    address?.district &&
    address?.districtId &&
    address?.province &&
    address?.provinceId,
  );

  const shippingMethodReady = Boolean(
    !addressComplete ||
    (
      !quoteLoading &&
      quote &&
      shippingOptions &&
      selectedShippingOption &&
      selectedShippingOption.available !== false &&
      typeof selectedShippingOption.fee === "number"
    )
  );

  const canSubmitOrder = Boolean(
    addressComplete &&
    quote &&
    !quoteLoading &&
    !quoteError &&
    shippingMethodReady,
  );

  useEffect(() => {
    let active = true;

    if (!checkoutItems.length) {
      setQuote(null);
      return undefined;
    }

    if (cartType === CART_TYPES.PREORDER && !preorderRuntimeEnabled) {
      setQuote(null);
      setQuoteError(new Error("Chức năng đặt trước hiện đang bị vô hiệu hóa."));
      return undefined;
    }

    if (skipInitialQuote) {
      setSkipInitialQuote(false);
      return undefined;
    }

    const payload = buildCheckoutPayload({
      items: checkoutItems,
      storeId: selectedStoreId || undefined,
      shippingMethod: shippingId,
      discountAmount:
        typeof cartDiscountAmount === "number" ? cartDiscountAmount : undefined,
      shippingAddress: addressComplete ? address : null,
      voucherCode: appliedVoucherCode || undefined,
      paymentMethod: paymentId,
      cartType: API_CART_TYPE[cartType] || "ready_stock",
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
        const message = extractApiErrorMessage(err);
        // console.warn(
        //   "checkout quote failed",
        //   err?.response?.data || err?.message || err,
        // );
        if (appliedVoucherCode && /voucher/i.test(message || "")) {
          setAppliedVoucherCode("");
          setVoucherMeta(null);
          setQuote(null);
          setQuoteError(null);
          Alert.alert(
            "Mã giảm giá không còn áp dụng",
            message || "Mã giảm giá hiện không còn hợp lệ với đơn hàng này.",
          );
          return;
        }
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
    appliedVoucherCode,
    paymentId,
    cartType,
    preorderRuntimeEnabled,
    selectedStoreId,
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
        shippingMethod: shippingId,
        shippingAddress: addressComplete ? address : undefined,
        paymentMethod: paymentId,
        cartType: API_CART_TYPE[cartType] || "ready_stock",
      };

      const validated = await validatePromotionApi(validatePayload);
      if (!validated?.valid) {
        throw new Error(validated?.message || "Mã giảm giá không hợp lệ.");
      }

      setAppliedVoucherCode(code);
      setVoucherMeta(validated?.voucher || null);

      const quotePayload = buildCheckoutPayload({
        items: checkoutItems,
        storeId: selectedStoreId || undefined,
        shippingMethod: shippingId,
        shippingAddress: addressComplete ? address : null,
        voucherCode: code,
        paymentMethod: paymentId,
        cartType: API_CART_TYPE[cartType] || "ready_stock",
      });

      const refreshedQuote = await fetchCheckoutQuote(quotePayload);
      setQuote(refreshedQuote);
      setQuoteError(null);
      setSkipInitialQuote(false);
      Alert.alert("Áp mã giảm giá thành công", `Đã áp dụng mã giảm giá ${code}.`);
    } catch (err) {
      const message = extractApiErrorMessage(err);
      Alert.alert(
        "Không áp dụng được mã giảm giá",
        message || "Vui lòng thử mã khác.",
      );
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const checkoutOrder = async () => {
    if (isSubmitting || !checkoutItems.length) return;
    if (cartType === CART_TYPES.PREORDER && !preorderRuntimeEnabled) {
      Alert.alert("Đặt trước đang tắt", "Admin đang tắt chức năng đặt hàng trước trong cấu hình hệ thống.");
      return;
    }

    if (!addressComplete) {
      Alert.alert("Thiếu địa chỉ", "Vui lòng nhập đầy đủ thông tin giao hàng.");
      return;
    }

    if (!quote || quoteLoading || quoteError) {
      Alert.alert(
        "Chưa tính được phí vận chuyển",
        "Vui lòng chờ hệ thống cập nhật phí vận chuyển hợp lệ trước khi tiếp tục.",
      );
      return;
    }

    const mergedNote = [autoNote, String(userNote || "").trim()]
      .filter(Boolean)
      .join("\n");

    try {
      setIsSubmitting(true);

      const payload = buildCheckoutPayload({
        items: checkoutItems,
        storeId: selectedStoreId || undefined,
        shippingMethod: shippingId,
        shippingAddress: addressComplete ? address : null,
        note: mergedNote || undefined,
        discountAmount:
          typeof cartDiscountAmount === "number"
            ? cartDiscountAmount
            : undefined,
        voucherCode: appliedVoucherCode || undefined,
        paymentMethod: paymentId,
        cartType: API_CART_TYPE[cartType] || "ready_stock",
      });

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // console.log("[Checkout] createCheckout prescription payload");
        // console.log(
        //   JSON.stringify(
        //     payload.items.map((item) => ({
        //       productId: item.productId || item.product_id,
        //       variantId: item.variantId || item.variant_id || null,
        //       customization: item.customization || null,
        //       prescription: item.customization?.prescription || null,
        //     })),
        //     null,
        //     2,
        //   )
        // );
      }

      const data = await createCheckout(payload);
      const orderId = data?.orderId || data?._id || data?.id || null;
      if (!orderId) {
        throw new Error("API thanh toán không trả về orderId.");
      }

      let orderPayload = null;

      try {
        orderPayload = await getOrderByIdApi(orderId, false);
      } catch (fetchOrderError) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // console.log(
          //   "checkout order detail fetch failed",
          //   fetchOrderError?.response?.data ||
          //     fetchOrderError?.message ||
          //     fetchOrderError,
          // );
        }
      }

      if (!orderPayload) {
        const breakdown = data?.breakdown || {};
        const serverPayment =
          data?.payment ||
          data?.paymentInstructions ||
          data?.paymentInstruction ||
          null;

        orderPayload = {
          _id: orderId,
          id: orderId,
          orderId,
          createdAt: data?.createdAt || null,
          shippingMethod: data?.shippingMethod || shippingId || null,
          shippingAddress: data?.shippingAddress || (addressComplete ? address : null),
          subtotal: breakdown.subtotal ?? null,
          shippingFee: breakdown.shippingFee ?? null,
          discountAmount: breakdown.discountAmount ?? null,
          total: breakdown.total ?? null,
          payNowTotal: breakdown.payNow ?? null,
          payLaterTotal: breakdown.payLater ?? null,
          voucherCode: data?.voucherCode || appliedVoucherCode || null,
          paymentMethod:
            data?.paymentMethod ||
            serverPayment?.method ||
            serverPayment?.paymentMethod ||
            paymentId ||
            null,
          paymentStatus:
            data?.paymentStatus ||
            serverPayment?.status ||
            serverPayment?.paymentStatus ||
            null,
          payment: serverPayment,
          items: [],
        };
      }

      navigation.navigate("CheckoutStatus", { order: orderPayload, cartType });
    } catch (err) {
      const data = err?.response?.data || {};
      const errors = Array.isArray(data.errors)
        ? data.errors
          .map((e) => e.msg)
          .filter(Boolean)
          .join("\n")
        : null;
      const message = errors || data.message || data.error || err?.message;
      Alert.alert(
        "Thanh toán thất bại",
        message || "Không thể tạo đơn hàng. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCheckout = () => {
    Alert.alert(
      "Hủy mua hàng",
      "Bạn có chắc muốn hủy mua hàng và quay lại giỏ hàng không?",
      [
        {
          text: "Không",
          style: "cancel",
        },
        {
          text: "Xác nhận",
          style: "destructive",
          onPress: () => {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
            activeOpacity={0.85}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán</Text>
        </View>
      </View>

      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 36) },
          ]}
        >
          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={isEditingAddress}
                onPress={() => startEditAddress(address)}
                style={[
                  styles.headerActionBtn,
                  isEditingAddress && styles.headerActionBtnDisabled,
                ]}
              >
                <Ionicons
                  name={hasAddress ? "create-outline" : "add-circle-outline"}
                  size={15}
                  color={isEditingAddress ? PALETTE.muted : PALETTE.navy}
                />
                <Text
                  style={[
                    styles.headerActionText,
                    isEditingAddress && styles.linkDisabled,
                  ]}
                >
                  {isEditingAddress
                    ? "Đang chỉnh sửa"
                    : hasAddress
                      ? "Sửa"
                      : "Thêm địa chỉ"}
                </Text>
              </TouchableOpacity>
            </View>

            {addressLoading ? (
              <Text style={styles.addressMeta}>Đang tải địa chỉ...</Text>
            ) : null}

            {isEditingAddress ? (
              <View style={styles.addressForm}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Họ và tên</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nhập họ và tên"
                    placeholderTextColor={PALETTE.muted}
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
                    placeholderTextColor={PALETTE.muted}
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
                    placeholderTextColor={PALETTE.muted}
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
                    placeholderTextColor={PALETTE.muted}
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
                    placeholder="Hầm/tầng/phòng (tuỳ chọn)"
                    placeholderTextColor={PALETTE.muted}
                    value={draftAddress.line2}
                    onChangeText={(value) =>
                      setDraftAddress((prev) => ({ ...prev, line2: value }))
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tỉnh / Thành phố</Text>
                  <View style={styles.pickerBox}>
                    <Picker
                      selectedValue={draftAddress.provinceId}
                      onValueChange={(value) => {
                        if (!value) {
                          setDraftAddress((prev) => ({
                            ...prev,
                            provinceId: "",
                            province: "",
                            districtId: "",
                            district: "",
                            wardCode: "",
                            ward: "",
                          }));
                          return;
                        }

                        const selected = provinces.find(
                          (p) => String(p.id) === String(value),
                        );
                        setDraftAddress((prev) => ({
                          ...prev,
                          provinceId: value,
                          province: selected?.name || "",
                          districtId: "",
                          district: "",
                          wardCode: "",
                          ward: "",
                        }));
                      }}
                    >
                      <Picker.Item label="Chọn tỉnh / thành phố" value="" />
                      {provinces.map((p) => (
                        <Picker.Item
                          key={String(p.id)}
                          label={p.name}
                          value={String(p.id)}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Quận / Huyện</Text>
                  <View style={styles.pickerBox}>
                    <Picker
                      enabled={!!draftAddress.provinceId}
                      selectedValue={draftAddress.districtId}
                      onValueChange={(value) => {
                        if (!value) {
                          setDraftAddress((prev) => ({
                            ...prev,
                            districtId: "",
                            district: "",
                            wardCode: "",
                            ward: "",
                          }));
                          return;
                        }

                        const selected = districts.find(
                          (d) => String(d.id) === String(value),
                        );
                        setDraftAddress((prev) => ({
                          ...prev,
                          districtId: value,
                          district: selected?.name || "",
                          wardCode: "",
                          ward: "",
                        }));
                      }}
                    >
                      <Picker.Item label="Chọn quận / huyện" value="" />
                      {districts.map((d) => (
                        <Picker.Item
                          key={String(d.id)}
                          label={d.name}
                          value={String(d.id)}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Phường / Xã</Text>
                  <View style={styles.pickerBox}>
                    <Picker
                      enabled={!!draftAddress.districtId}
                      selectedValue={draftAddress.wardCode}
                      onValueChange={(value) => {
                        if (!value) {
                          setDraftAddress((prev) => ({
                            ...prev,
                            wardCode: "",
                            ward: "",
                          }));
                          return;
                        }

                        const selected = wards.find(
                          (w) => String(w.code) === String(value),
                        );
                        setDraftAddress((prev) => ({
                          ...prev,
                          wardCode: value,
                          ward: selected?.name || "",
                        }));
                      }}
                    >
                      <Picker.Item label="Chọn phường / xã" value="" />
                      {wards.map((w) => (
                        <Picker.Item
                          key={String(w.code)}
                          label={w.name}
                          value={w.code}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.addressActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnGhost]}
                    activeOpacity={0.85}
                    onPress={cancelEditAddress}
                  >
                    <Text style={[styles.actionText, styles.actionTextGhost]}>
                      Hủy
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    activeOpacity={0.85}
                    onPress={saveEditAddress}
                  >
                    <Text style={[styles.actionText, styles.actionTextPrimary]}>
                      Lưu
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {hasAddress ? (
                  <>
                    <Text style={styles.addressName}>
                      {address.fullName || "--"}
                    </Text>
                    <Text style={styles.addressMeta}>
                      {address.phone || "--"}
                    </Text>
                    {address.email ? (
                      <Text style={styles.addressMeta}>{address.email}</Text>
                    ) : null}
                    {buildAddressLines(address).map((line, idx) => (
                      <Text key={`${line}-${idx}`} style={styles.addressMeta}>
                        {line}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={styles.addressEmpty}>
                    Chưa có địa chỉ giao hàng
                  </Text>
                )}

                {savedAddresses.length > 0 ? (
                  <View style={styles.savedAddressList}>
                    <Text style={styles.savedAddressTitle}>Địa chỉ đã lưu</Text>
                    {savedAddresses.map((item) => {
                      const selected =
                        String(item?._id || "") === String(address?._id || "");

                      return (
                        <TouchableOpacity
                          key={item?._id || `${item.line1}-${item.phone}`}
                          activeOpacity={0.85}
                          style={[
                            styles.savedAddressItem,
                            selected && styles.savedAddressItemActive,
                          ]}
                          onPress={() => {
                            void chooseSavedAddress(item);
                          }}
                        >
                          <View style={styles.savedAddressHeader}>
                            <Text style={styles.savedAddressName}>
                              {item.fullName || "--"}
                            </Text>
                            <View style={styles.savedAddressBadges}>
                              {item.isDefault ? (
                                <View style={styles.savedAddressBadge}>
                                  <Text style={styles.savedAddressBadgeText}>
                                    Mặc định
                                  </Text>
                                </View>
                              ) : null}
                              {selected ? (
                                <View
                                  style={[
                                    styles.savedAddressBadge,
                                    styles.savedAddressBadgeActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.savedAddressBadgeText,
                                      styles.savedAddressBadgeTextActive,
                                    ]}
                                  >
                                    Đang chọn
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.savedAddressMeta}>
                            {item.phone || "--"}
                          </Text>
                          <Text
                            style={styles.savedAddressMeta}
                            numberOfLines={2}
                          >
                            {buildAddressLines(item).join(" - ") || "--"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.addAddressBtn}
                  onPress={() => startEditAddress({ ...EMPTY_ADDRESS })}
                >
                  <Text style={styles.addAddressText}>+ Thêm địa chỉ</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phương thức giao hàng</Text>

            <View style={styles.radioList}>
              {shippingMethods.map((m) => {
                const active = m.id === shippingId;
                const disabled =
                  addressComplete && shippingOptions ? !m.available : false;

                return (
                  <TouchableOpacity
                    key={m.id}
                    activeOpacity={0.85}
                    style={[
                      styles.radioItem,
                      active && styles.radioItemActive,
                      disabled && styles.radioItemDisabled,
                    ]}
                    onPress={() => {
                      if (disabled) return;
                      setShippingId(m.id);
                    }}
                  >
                    <View
                      style={[styles.radioDot, active && styles.radioDotActive]}
                    >
                      {active && <View style={styles.radioDotInner} />}
                    </View>
                    <View style={styles.radioInfo}>
                      <View style={styles.radioRow}>
                        <Text style={styles.radioLabel}>{m.label}</Text>
                        <Text style={styles.radioPrice}>
                          {typeof m.fee === "number"
                            ? formatVND(m.fee)
                            : addressComplete
                              ? m.available
                                ? "Đang tính..."
                                : "Không hỗ trợ"
                              : hasAddress
                                ? "Cần chuẩn hóa"
                                : "Chọn địa chỉ"}
                        </Text>
                      </View>
                      <Text style={styles.radioEta}>{m.eta}</Text>
                      {!addressComplete && hasAddress ? (
                        <Text style={styles.shippingNote}>
                          Địa chỉ hiện tại chưa có mã GHN. Bấm "Sửa" để kiểm tra
                          lại nếu giá ship chưa hiện.
                        </Text>
                      ) : null}
                      {addressComplete && m.message ? (
                        <Text style={styles.shippingNote}>{m.message}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {hasPreorder ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Đơn có sản phẩm đặt trước, thời gian giao dự kiến tính sau khi
                  có hàng.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>

            <View style={styles.radioList}>
              {paymentMethods.map((method) => {
                const isActive = method.id === paymentId;
                return (
                  <TouchableOpacity
                    key={method.id}
                    activeOpacity={0.9}
                    onPress={() => setPaymentId(method.id)}
                    style={[
                      styles.radioItem,
                      isActive && styles.radioItemActive,
                    ]}
                  >
                    <View style={[styles.radioDot, isActive && styles.radioDotActive]}>
                      {isActive ? <View style={styles.radioDotInner} /> : null}
                    </View>
                    <View style={styles.radioInfo}>
                      <View style={styles.radioRow}>
                        <Text style={styles.radioLabel}>{method.label}</Text>
                      </View>
                      <Text style={styles.radioEta}>{method.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {hasPreorder ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Đơn đặt trước cần đặt cọc qua SePay, phần còn lại thanh toán
                  khi nhận hàng.
                </Text>
              </View>
            ) : paymentId === "cod" ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Đơn hàng sẽ được thu toàn bộ khi giao hàng thành công (COD).
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
                placeholderTextColor={PALETTE.muted}
              />
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.voucherBtn,
                  isApplyingVoucher && styles.voucherBtnDisabled,
                ]}
                disabled={isApplyingVoucher}
                onPress={applyVoucher}
              >
                <Text style={styles.voucherBtnText}>
                  {isApplyingVoucher ? "Đang áp..." : "Áp dụng"}
                </Text>
              </TouchableOpacity>
            </View>

            {appliedVoucherCode ? (
              <Text style={styles.voucherHint}>
                Đã áp dụng: {appliedVoucherCode}
                {voucherMeta?.type ? ` (${voucherMeta.type})` : ""}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Ghi chú đơn hàng (không bắt buộc)
            </Text>
            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="VD: Hãy cẩn thận khi giao hàng..."
              placeholderTextColor={PALETTE.muted}
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
              <Text style={styles.summaryLabel}>
                Phí vận chuyển ({getShippingFeeModeLabel(shippingFeeMode)})
              </Text>
              <Text style={styles.summaryValue}>{formatVND(shipping)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Thu phí ship</Text>
              <Text style={styles.summaryValue}>
                {getShippingCollectionTimingLabel(shippingCollectionTiming)}
              </Text>
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

            {hasPreorder || payLater > 0 ? (
              <>
                {payNow > 0 ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Trả trước ({payNowMethod})</Text>
                    <Text style={styles.summaryValue}>{formatVND(payNow)}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {hasPreorder ? "Còn lại" : "Thanh toán khi nhận hàng"}{" "}
                    {payLaterMethod ? `(${payLaterMethod})` : ""}
                  </Text>
                  <Text style={styles.summaryValue}>{formatVND(payLater)}</Text>
                </View>
                <Text style={styles.quoteHint}>
                  Phí ship: {getShippingFeeModeLabel(shippingFeeMode).toLowerCase()} •{" "}
                  {getShippingCollectionTimingLabel(shippingCollectionTiming)}
                </Text>
              </>
            ) : null}

            {quoteLoading ? (
              <Text style={styles.quoteHint}>Đang cập nhật giá...</Text>
            ) : null}

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
              (!canSubmitOrder || isSubmitting) && styles.continueBtnDisabled,
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              },
            ]}
            onPress={checkoutOrder}
            disabled={isSubmitting || !checkoutItems.length || !canSubmitOrder}
          >
            <FontAwesome6 name="check-circle" size={16} color={PALETTE.white} />
            <Text style={styles.continueText}>
              {isSubmitting ? "Đang tạo đơn..." : "Tiếp tục"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.cancelBtn,
              {
                marginBottom: insets.bottom > 0 ? insets.bottom + 8 : 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              },
            ]}
            onPress={handleCancelCheckout}
          >
            <Ionicons name="close-circle-outline" size={16} color="#B91C1C" />
            <Text style={styles.cancelText}>Hủy</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
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
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },

  card: {
    marginTop: 12,
    backgroundColor: PALETTE.white,
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
  sectionTitle: { fontSize: 14, fontWeight: "900", color: PALETTE.text },
  linkText: { fontSize: 12.5, fontWeight: "800", color: PALETTE.navy },
  linkDisabled: { color: PALETTE.muted },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.navy,
    backgroundColor: PALETTE.navyTint,
  },
  headerActionBtnDisabled: {
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
  },
  headerActionText: {
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.navy,
  },

  addressName: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "900",
    color: PALETTE.text,
  },
  addressMeta: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  addressEmpty: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  savedAddressList: { marginTop: 14, gap: 10 },
  savedAddressTitle: { fontSize: 12.5, fontWeight: "900", color: PALETTE.text },
  savedAddressItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    padding: 12,
    gap: 6,
  },
  savedAddressItemActive: {
    borderColor: PALETTE.navy,
    backgroundColor: PALETTE.navyTint,
  },
  savedAddressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  savedAddressName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    color: PALETTE.text,
  },
  savedAddressBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
  },
  savedAddressBadge: {
    borderRadius: 999,
    backgroundColor: PALETTE.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedAddressBadgeActive: {
    backgroundColor: PALETTE.navyTint,
    borderWidth: 1,
    borderColor: PALETTE.navy,
  },
  savedAddressBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: PALETTE.navy,
  },
  savedAddressBadgeTextActive: {
    color: PALETTE.navy,
  },
  savedAddressMeta: { fontSize: 12, fontWeight: "700", color: PALETTE.muted },

  addressForm: { marginTop: 10, gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12.5, fontWeight: "800", color: PALETTE.muted },
  fieldInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.text,
    backgroundColor: PALETTE.white,
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
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  actionBtnPrimary: { backgroundColor: PALETTE.navy },
  actionText: { fontSize: 13, fontWeight: "900" },
  actionTextGhost: { color: PALETTE.text },
  actionTextPrimary: { color: PALETTE.white },

  addAddressBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: PALETTE.navyTint,
  },
  addAddressText: { fontSize: 12.5, fontWeight: "800", color: PALETTE.navy },

  radioList: { marginTop: 10, gap: 10 },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  radioItemActive: {
    borderColor: PALETTE.navy,
    backgroundColor: PALETTE.navyTint,
  },
  radioItemDisabled: { opacity: 0.55 },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotActive: { borderColor: PALETTE.navy },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.navy,
  },
  radioInfo: { flex: 1, marginLeft: 10 },
  radioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  radioLabel: { fontSize: 13.5, fontWeight: "900", color: PALETTE.text },
  radioPrice: { fontSize: 13, fontWeight: "900", color: PALETTE.text },
  radioEta: { marginTop: 4, fontSize: 12, fontWeight: "700", color: PALETTE.muted },
  shippingNote: {
    marginTop: 4,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#B91C1C",
  },

  noticeBox: {
    marginTop: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 10,
  },
  noticeText: { fontSize: 12.5, fontWeight: "700", color: PALETTE.muted },

  noteInput: {
    marginTop: 10,
    minHeight: 90,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.text,
    backgroundColor: PALETTE.white,
  },

  voucherRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  voucherInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.text,
    backgroundColor: PALETTE.white,
  },
  voucherBtn: {
    height: 44,
    minWidth: 88,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherBtnDisabled: { opacity: 0.7 },
  voucherBtnText: { color: PALETTE.white, fontSize: 12.5, fontWeight: "900" },
  voucherHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 13, fontWeight: "800", color: PALETTE.muted },
  summaryValue: { fontSize: 13, fontWeight: "900", color: PALETTE.text },
  summaryDivider: { height: 1, backgroundColor: PALETTE.border, marginVertical: 8 },
  summaryTotalLabel: { fontSize: 14, fontWeight: "900", color: PALETTE.text },
  summaryTotalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },
  quoteHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  quoteError: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
  },

  continueBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueText: { fontSize: 14, fontWeight: "900", color: PALETTE.white },

  pickerBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    overflow: "hidden",
  },

  cancelBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#B91C1C",
  },
});
