import React, { useMemo, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CART_TYPES } from "../store/cartStore";
import {
  buildCheckoutPayload,
  fetchCheckoutQuote,
} from "../services/checkoutService";
import {
  API_CART_TYPES,
  getMyCartApi,
  setCartBadgeQty,
  syncCartBadgeQty,
  upsertCartItemApi,
  removeCartItemApi,
  clearCartApi,
} from "../services/cartService";
import { useProducts } from "../hooks/useProducts";
import CartItemEditModal from "../components/CartItemEditModal";
import {
  getCatalogDisplayLabel,
  normalizeCatalogType,
  normalizeType,
  productRequiresLensRxFlow,
  productSupportsLensPairing,
} from "../services/productService";
import {
  inferLensPrescriptionMethod,
  summarizeLensPrescription,
  validateLensPrescriptionDraft,
} from "../services/lensPrescriptionService";

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v || 0) + "đ";

const ORDER_TYPE_LABEL = {
  READY: "Nhận thông số",
  PREORDER: "Đặt trước",
  CUSTOM: "Làm theo đơn",
};

const UI_TO_API_CART_TYPE = {
  [CART_TYPES.ORDER]: API_CART_TYPES.READY_STOCK,
  [CART_TYPES.PREORDER]: API_CART_TYPES.PRE_ORDER,
};

function inferOrderTypeFromItem(item) {
  if (item?.preOrder) return "PREORDER";
  const mode = String(item?.customization?.prescription?.mode || "").toLowerCase();
  if (mode === "attachment" || mode === "upload") return "CUSTOM";
  return "READY";
}

function buildLensPrescriptionState(product, customization) {
  const prescription = customization?.prescription || {};
  const method = inferLensPrescriptionMethod(prescription);
  const summary = summarizeLensPrescription(prescription);
  const validation = validateLensPrescriptionDraft({
    method,
    draft: prescription,
    product,
  });

  return { method, summary, validation };
}

function isCartItemComplete(ci) {
  if (!productRequiresLensRxFlow(ci?.product)) return true;
  return buildLensPrescriptionState(ci?.product, ci?.customization).validation.valid;
}

function getDepositPercent(ci) {
  const raw =
    ci?.depositPercent ??
    ci?.preOrderConfig?.depositPercent ??
    ci?.product?.preOrder?.depositPercent;
  const value = Number(raw);
  if (Number.isFinite(value) && value >= 0) {
    return Math.min(100, value);
  }
  return ci?.isPreorder ? 100 : 100;
}

function formatPercent(value) {
  const normalized = Math.max(0, Number(value || 0));
  return Number.isInteger(normalized) ? `${normalized}%` : `${normalized.toFixed(1)}%`;
}

function calcLineTotal(ci) {
  if (Number.isFinite(Number(ci?.payNow))) {
    return Math.max(0, Number(ci.payNow));
  }

  const unitPrice =
    ci.product?.price ??
    ci.product?.pricing?.salePrice ??
    ci.product?.pricing?.basePrice ??
    ci.unitPrice ??
    0;
  const depositPercent = getDepositPercent(ci);
  const lineTotal = unitPrice * (ci.qty || 0);
  return Math.round(lineTotal * (depositPercent / 100));
}

function calcLineTotalFull(ci) {
  const unitPrice =
    ci.product?.price ??
    ci.product?.pricing?.salePrice ??
    ci.product?.pricing?.basePrice ??
    ci.unitPrice ??
    0;
  return unitPrice * (ci.qty || 0);
}

function calcLinePayLater(ci) {
  if (Number.isFinite(Number(ci?.payLater))) {
    return Math.max(0, Number(ci.payLater));
  }

  return Math.max(0, calcLineTotalFull(ci) - calcLineTotal(ci));
}

function TabBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <View style={styles.tabBadge}>
      <Text style={styles.tabBadgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

function buildAutoPairingNote(cartItems) {
  const lines = [];

  for (const ci of cartItems || []) {
    const combineWith = ci?.customization?.combineWith;
    if (!combineWith?.productId) continue;

    const lensName = ci?.product?.name || ci?.name || "Tròng";
    const frameName = ci?.combineWithName || combineWith?.note || "Gọng";

    if (productRequiresLensRxFlow(ci?.product)) {
      lines.push(`Tròng ${lensName} gắn với gọng ${frameName}.`);
    }
  }

  return Array.from(new Set(lines)).join("\n");
}

function mapApiCartItemToUi(item, products = []) {
  const matchedProduct =
    products.find(
      (p) =>
        String(p.apiId || p._id || p.id) === String(item.productId)
    ) || null;

  const orderType = inferOrderTypeFromItem(item);
  const selectedColor = item?.customization?.selectedColor || null;
  const selectedSize = item?.customization?.selectedSize || null;

  const colorObj =
    matchedProduct?.colors?.find(
      (c) =>
        String(c.name || c.label || c.id).toLowerCase() ===
        String(selectedColor || "").toLowerCase()
    ) || null;

  const imageOverride = colorObj?.imageOverride || null;
  const catalogType = matchedProduct?.catalogType || normalizeCatalogType(item?.type);
  const displayLabel = matchedProduct?.displayLabel || getCatalogDisplayLabel(catalogType);
  const requiresLensRxFlow = matchedProduct
    ? productRequiresLensRxFlow(matchedProduct)
    : catalogType === "LENS";
  const supportsLensPairing = matchedProduct
    ? productSupportsLensPairing(matchedProduct)
    : catalogType === "FRAME";

  const product = matchedProduct
    ? {
      ...matchedProduct,
      image: imageOverride || matchedProduct.image,
      preOrder: item?.preOrderConfig || matchedProduct.preOrder || null,
    }
    : {
      id: item.productId,
      apiId: item.productId,
      name: item.name || "Sản phẩm",
      type: normalizeType(catalogType),
      apiType: item.type || null,
      catalogType,
      displayLabel,
      requiresLensRxFlow,
      supportsLensPairing,
      image: "",
      price: item.unitPrice || 0,
      originalPrice: null,
      preOrder: item?.preOrderConfig || null,
    };

  let variantText = null;
  if (catalogType === "FRAME" || catalogType === "SUNGLASSES") {
    variantText = [selectedColor, selectedSize].filter(Boolean).join(" • ") || null;
  } else if (selectedColor) {
    variantText = selectedColor;
  } else if (selectedSize) {
    variantText = selectedSize;
  }

  return {
    ...item,
    key: item._id,
    qty: item.quantity || 1,
    isPreorder: Boolean(item.preOrder),
    orderType,
    product,
    unitPrice: item.unitPrice || product?.price || 0,
    lineTotal: item.lineTotal || 0,
    depositPercent: (() => {
      const value = Number(
        item.depositPercent ??
        item?.preOrderConfig?.depositPercent ??
        product?.preOrder?.depositPercent,
      );
      return Number.isFinite(value) ? value : 100;
    })(),
    payNow: item.payNow != null ? Number(item.payNow) : undefined,
    payLater: item.payLater != null ? Number(item.payLater) : undefined,
    preOrderConfig: item?.preOrderConfig || product?.preOrder || null,
    variantText,
    readyNote: item?.customization?.note || "",
    customization: item?.customization || {},
    combineWithName: item?.customization?.combineWith?.note || "",
    prescriptionState: requiresLensRxFlow
      ? buildLensPrescriptionState(product, item?.customization || {})
      : null,
  };
}

function buildUpsertPayloadFromUiItem(ci, nextQty) {
  return {
    itemId: ci._id,
    productId: String(ci.productId || ci.product?.apiId || ci.product?.id || ""),
    variantId: ci.variantId || undefined,
    quantity: Math.max(1, nextQty),
    customization: ci.customization || {},
  };
}

function buildCheckoutItemsFromApiUi(cartItems) {
  return cartItems
    .filter((ci) => ci?.productId || ci?.product?.apiId || ci?.product?.id)
    .map((ci) => ({
      productId: String(ci.productId || ci.product?.apiId || ci.product?.id),
      variantId: ci.variantId || undefined,
      quantity: ci.qty || 1,
      customization: ci.customization || {},
    }));
}

function getItemShippingCollectionTiming(ci) {
  return String(
    ci?.preOrderConfig?.shippingCollectionTiming ||
    ci?.product?.preOrder?.shippingCollectionTiming ||
    "",
  )
    .trim()
    .toLowerCase();
}

function getMixedPreorderShippingTiming(cartItems = []) {
  const grouped = new Map();

  for (const ci of cartItems) {
    if (!ci?.isPreorder) continue;

    const timing = getItemShippingCollectionTiming(ci);
    if (!timing) continue;
    const names = grouped.get(timing) || [];
    names.push(ci?.product?.name || ci?.name || "Sản phẩm");
    grouped.set(timing, names);
  }

  if (grouped.size <= 1) return null;
  return grouped;
}

function isCombinableType(type) {
  if (!type || typeof type !== "object") return false;
  return productRequiresLensRxFlow(type) || productSupportsLensPairing(type);
}

function findCombinedPartner(cartItems, ci) {
  const combineWith = ci?.customization?.combineWith;
  if (!combineWith?.productId) return null;

  return (
    (cartItems || []).find(
      (item) =>
        item?._id !== ci?._id &&
        String(item?.productId || item?.product?.apiId || item?.product?.id || "") ===
        String(combineWith.productId) &&
        String(item?.variantId || "") === String(combineWith.variantId || ""),
    ) || null
  );
}

function buildCombinePatch(ci, partner) {
  return {
    ...buildUpsertPayloadFromUiItem(ci, ci?.qty || 1),
    customization: {
      ...(ci?.customization || {}),
      combineWith: {
        productId: String(partner?.productId || partner?.product?.apiId || partner?.product?.id || ""),
        variantId: partner?.variantId || "",
        note: partner?.product?.name || partner?.name || "",
      },
    },
  };
}

function buildClearCombinePatch(ci) {
  const customization = { ...(ci?.customization || {}) };
  delete customization.combineWith;

  return {
    ...buildUpsertPayloadFromUiItem(ci, ci?.qty || 1),
    customization,
  };
}

export default function CartScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { products } = useProducts();

  const [isQuoting, setIsQuoting] = useState(false);
  const [loadingCart, setLoadingCart] = useState(false);

  const [readyCart, setReadyCart] = useState(null);
  const [preorderCart, setPreorderCart] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const [activeCartType, setActiveCartType] = useState(
    route?.params?.cartType === CART_TYPES.PREORDER ? CART_TYPES.PREORDER : CART_TYPES.ORDER
  );

  const loadCarts = useCallback(async () => {
    try {
      setLoadingCart(true);
      const [ready, preorder] = await Promise.all([
        getMyCartApi(API_CART_TYPES.READY_STOCK),
        getMyCartApi(API_CART_TYPES.PRE_ORDER),
      ]);
      setReadyCart(ready || null);
      setPreorderCart(preorder || null);
      syncCartBadgeQty({
        readyItems: Array.isArray(ready?.items) ? ready.items : [],
        preorderItems: Array.isArray(preorder?.items) ? preorder.items : [],
      });
    } catch (err) {
      console.log("loadCarts error:", err);
      setReadyCart(null);
      setPreorderCart(null);
      setCartBadgeQty(0);
    } finally {
      setLoadingCart(false);
    }
  }, []);

  useEffect(() => {
    if (route?.params?.cartType === CART_TYPES.PREORDER) {
      setActiveCartType(CART_TYPES.PREORDER);
      return;
    }
    if (route?.params?.cartType === CART_TYPES.ORDER) {
      setActiveCartType(CART_TYPES.ORDER);
    }
  }, [route?.params?.cartType]);

  useFocusEffect(
    useCallback(() => {
      loadCarts();
    }, [loadCarts])
  );

  const readyItems = useMemo(() => {
    const items = Array.isArray(readyCart?.items) ? readyCart.items : [];
    return items.map((it) => mapApiCartItemToUi(it, products));
  }, [readyCart, products]);

  const preorderItems = useMemo(() => {
    const items = Array.isArray(preorderCart?.items) ? preorderCart.items : [];
    return items.map((it) => mapApiCartItemToUi(it, products));
  }, [preorderCart, products]);

  const cartItems = useMemo(
    () => (activeCartType === CART_TYPES.PREORDER ? preorderItems : readyItems),
    [activeCartType, readyItems, preorderItems]
  );

  const canCheckout = useMemo(() => {
    if (cartItems.length === 0) return false;
    return cartItems.every(isCartItemComplete);
  }, [cartItems]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, ci) => sum + calcLineTotal(ci), 0),
    [cartItems]
  );
  const payLaterTotal = useMemo(
    () => cartItems.reduce((sum, ci) => sum + calcLinePayLater(ci), 0),
    [cartItems]
  );
  const grandTotal = Math.max(0, subtotal + payLaterTotal);

  const discount = 0;
  const shipping = 0;
  const total = Math.max(0, subtotal - discount + shipping);

  const checkoutItems = useMemo(
    () => buildCheckoutItemsFromApiUi(cartItems),
    [cartItems]
  );

  const shippingMethod = "standard";

  const setQty = async (ci, nextQty) => {
    if (!ci?._id) return;
    if (nextQty < 1) {
      removeItem(ci);
      return;
    }

    try {
      const apiCartType = UI_TO_API_CART_TYPE[activeCartType] || API_CART_TYPES.READY_STOCK;
      await upsertCartItemApi(apiCartType, buildUpsertPayloadFromUiItem(ci, nextQty));
      await loadCarts();
    } catch (err) {
      const data = err?.response?.data || {};
      Alert.alert(
        "Không cập nhật được số lượng",
        data?.message || data?.error || err?.message || "Vui lòng thử lại.",
      );
    }
  };

  const removeItem = (ci) => {
    Alert.alert("Xóa sản phẩm", "Bạn chắc chắn muốn xóa sản phẩm khỏi giỏ?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const apiCartType = UI_TO_API_CART_TYPE[activeCartType] || API_CART_TYPES.READY_STOCK;
            await removeCartItemApi(apiCartType, ci._id);
            await loadCarts();
          } catch (err) {
            const data = err?.response?.data || {};
            Alert.alert(
              "Không xóa được sản phẩm",
              data?.message || data?.error || err?.message || "Vui lòng thử lại.",
            );
          }
        },
      },
    ]);
  };

  const openEdit = (ci) => {
    setEditingItem(ci);
  };

  const saveEdit = async (ci, patch) => {
    try {
      const apiCartType = UI_TO_API_CART_TYPE[activeCartType] || API_CART_TYPES.READY_STOCK;
      await upsertCartItemApi(apiCartType, {
        ...buildUpsertPayloadFromUiItem(ci, ci?.qty || 1),
        customization: patch?.customization || ci?.customization || {},
      });
      setEditingItem(null);
      await loadCarts();
    } catch (err) {
      const data = err?.response?.data || {};
      Alert.alert(
        "Không cập nhật được sản phẩm",
        data?.message || data?.error || err?.message || "Vui lòng thử lại.",
      );
    }
  };

  const openCombine = (ci) => {
    const sourceProduct = ci?.product || null;
    const isLensFlow = productRequiresLensRxFlow(sourceProduct);
    if (!isCombinableType(sourceProduct)) return;

    const candidates = cartItems.filter(
      (item) =>
        item?._id !== ci?._id &&
        (isLensFlow
          ? productSupportsLensPairing(item?.product)
          : productRequiresLensRxFlow(item?.product)),
    );

    if (!candidates.length) {
      Alert.alert(
        "Chưa có sản phẩm để kết hợp",
        isLensFlow
          ? "Bạn cần thêm gọng tương thích vào giỏ để kết hợp."
          : "Bạn cần thêm tròng vào giỏ để kết hợp.",
      );
      return;
    }

    const currentPartner = findCombinedPartner(cartItems, ci);
    const buttons = [];

    if (currentPartner) {
      buttons.push({
        text: "Bỏ kết hợp",
        style: "destructive",
        onPress: async () => {
          try {
            const apiCartType = UI_TO_API_CART_TYPE[activeCartType] || API_CART_TYPES.READY_STOCK;
            await Promise.all([
              upsertCartItemApi(apiCartType, buildClearCombinePatch(ci)),
              upsertCartItemApi(apiCartType, buildClearCombinePatch(currentPartner)),
            ]);
            await loadCarts();
          } catch (err) {
            const data = err?.response?.data || {};
            Alert.alert(
              "Không cập nhật được kết hợp",
              data?.message || data?.error || err?.message || "Vui lòng thử lại.",
            );
          }
        },
      });
    }

    candidates.forEach((candidate) => {
      buttons.push({
        text: candidate?.product?.name || "Sản phẩm",
        onPress: async () => {
          try {
            const apiCartType = UI_TO_API_CART_TYPE[activeCartType] || API_CART_TYPES.READY_STOCK;
            const candidatePartner = findCombinedPartner(cartItems, candidate);
            const requests = [upsertCartItemApi(apiCartType, buildCombinePatch(ci, candidate))];

            if (currentPartner && currentPartner?._id !== candidate?._id) {
              requests.push(upsertCartItemApi(apiCartType, buildClearCombinePatch(currentPartner)));
            }

            if (candidatePartner && candidatePartner?._id !== ci?._id) {
              requests.push(upsertCartItemApi(apiCartType, buildClearCombinePatch(candidatePartner)));
            }

            requests.push(upsertCartItemApi(apiCartType, buildCombinePatch(candidate, ci)));

            await Promise.all(requests);
            await loadCarts();
            Alert.alert(
              "Đã kết hợp",
              `${ci?.product?.name || "Sản phẩm"} ↔ ${candidate?.product?.name || "Sản phẩm"}`,
            );
            console.log(`${ci?.product?.name || "Sản phẩm"} ↔ ${candidate?.product?.name || "Sản phẩm"}`);
          } catch (err) {
            const data = err?.response?.data || {};
            Alert.alert(
              "Không cập nhật được kết hợp",
              data?.message || data?.error || err?.message || "Vui lòng thử lại.",
            );
          }
        },
      });
    });

    buttons.push({ text: "Hủy", style: "cancel" });

    Alert.alert(
      isLensFlow ? "Chọn gọng để gắn" : "Chọn tròng để gắn",
      "Kết hợp 1-1 để ghi chú rõ cho đơn.",
      buttons,
    );
  };

  const proceedCheckout = async () => {
    if (!canCheckout || isQuoting) return;

    if (checkoutItems.length !== cartItems.length) {
      Alert.alert(
        "Thiếu thông tin sản phẩm",
        "Một số sản phẩm trong giỏ không có ID hợp lệ. Vui lòng xóa và thêm lại sản phẩm."
      );
      return;
    }

    const autoNote = buildAutoPairingNote(cartItems);
    const mixedPreorderShippingTiming = getMixedPreorderShippingTiming(cartItems);

    if (activeCartType === CART_TYPES.PREORDER && mixedPreorderShippingTiming) {
      Alert.alert(
        "Không thể thanh toán chung",
        "Các sản phẩm đặt trước trong cùng một đơn phải có cùng thời điểm thu phí vận chuyển. Vui lòng tách thành các đơn riêng hoặc xóa bớt sản phẩm trong giỏ.",
      );
      return;
    }

    try {
      setIsQuoting(true);

      const inferredCartType =
        activeCartType === CART_TYPES.PREORDER ? CART_TYPES.PREORDER : CART_TYPES.ORDER;

      const payload = buildCheckoutPayload({
        items: checkoutItems,
        shippingFee: shipping,
        discountAmount: discount,
        shippingMethod,
        cartType: UI_TO_API_CART_TYPE[inferredCartType] || "ready_stock",
      });

      const quote = await fetchCheckoutQuote(payload);

      navigation.navigate("Checkout", {
        quote,
        cartItems,
        checkoutItems,
        quoteMeta: {
          shippingFee: shipping,
          discountAmount: discount,
          shippingMethod,
          cartType: inferredCartType,
          autoNote,
        },
      });
    } catch (err) {
      const data = err?.response?.data || {};
      const errors = Array.isArray(data.errors)
        ? data.errors.map((e) => e.msg).filter(Boolean).join("\n")
        : null;
      const rawMessage = errors || data.message || data.error || err?.message;
      const message =
        String(rawMessage || "").includes(
          "Pre-order items in the same order must share the same shipping collection timing",
        )
          ? "Các sản phẩm đặt trước trong cùng một đơn phải có cùng thời điểm thu phí vận chuyển. Vui lòng tách thành các đơn riêng hoặc xóa bớt sản phẩm trong giỏ."
          : rawMessage;
      Alert.alert("Không lấy được báo giá", message || "Vui lòng thử lại.");
    } finally {
      setIsQuoting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.85}
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.85}
          onPress={() => {
            if (cartItems.length === 0) return;
            Alert.alert("Xóa tất cả", "Bạn muốn xóa toàn bộ giỏ hàng đang chọn?", [
              { text: "Hủy", style: "cancel" },
              {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                  try {
                    const apiCartType =
                      UI_TO_API_CART_TYPE[activeCartType] || API_CART_TYPES.READY_STOCK;
                    await clearCartApi(apiCartType);
                    await loadCarts();
                  } catch (err) {
                    const data = err?.response?.data || {};
                    Alert.alert(
                      "Không xóa được giỏ hàng",
                      data?.message || data?.error || err?.message || "Vui lòng thử lại.",
                    );
                  }
                },
              },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 16 + Math.max(insets.bottom, 8) + 90 },
        ]}
      >
        <View style={styles.cartTypeSwitch}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.cartTypeBtn, activeCartType === CART_TYPES.ORDER && styles.cartTypeBtnActive]}
            onPress={() => setActiveCartType(CART_TYPES.ORDER)}
          >
            <Text style={[styles.cartTypeText, activeCartType === CART_TYPES.ORDER && styles.cartTypeTextActive]}>
              Mua ngay
            </Text>
            <TabBadge count={readyItems.length} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.cartTypeBtn, activeCartType === CART_TYPES.PREORDER && styles.cartTypeBtnActive]}
            onPress={() => setActiveCartType(CART_TYPES.PREORDER)}
          >
            <Text style={[styles.cartTypeText, activeCartType === CART_TYPES.PREORDER && styles.cartTypeTextActive]}>
              Đặt trước
            </Text>
            <TabBadge count={preorderItems.length} />
          </TouchableOpacity>
        </View>

        {loadingCart ? (
          <View style={styles.emptyBox}>
            <Ionicons name="time-outline" size={44} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Đang tải giỏ hàng...</Text>
          </View>
        ) : cartItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cart-outline" size={44} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Giỏ hàng trống</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.goShopBtn}
              onPress={() =>
                navigation.navigate("Tabs", {
                  screen: "ProductsTab",
                  params: { screen: "Products" },
                })
              }
            >
              <Text style={styles.goShopText}>Đi mua sắm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cartItems.map((ci) => (
            <CartItemCard
              key={ci.key}
              ci={ci}
              onDec={() => setQty(ci, (ci.qty || 1) - 1)}
              onInc={() => setQty(ci, (ci.qty || 1) + 1)}
              onRemove={() => removeItem(ci)}
              onEdit={() => openEdit(ci)}
              onCombine={
                isCombinableType(ci?.product) ? () => openCombine(ci) : null
              }
            />
          ))
        )}

        {cartItems.length > 0 ? (
          <>
            <View style={styles.summaryCard}>
              {!canCheckout ? (
                <View style={styles.warnBar}>
                  <View style={styles.warnIconWrap}>
                    <Ionicons name="warning" size={16} color="#B45309" />
                  </View>
                  <Text style={styles.warnText}>
                    Vui lòng hoàn thành thông tin tròng (nhập Rx hoặc tải ảnh đơn kính) trước khi thanh toán
                  </Text>
                </View>
              ) : null}

              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>
                  {activeCartType === CART_TYPES.PREORDER
                    ? "Tạm tính cần trả trước"
                    : "Tạm tính (cần thanh toán)"}
                </Text>
                <Text style={styles.sumValue}>{formatVND(subtotal)}</Text>
              </View>
              {activeCartType === CART_TYPES.PREORDER ? (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>COD còn lại</Text>
                  <Text style={styles.sumValue}>{formatVND(payLaterTotal)}</Text>
                </View>
              ) : null}
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Giảm giá</Text>
                <Text style={styles.sumValue}>-{formatVND(discount)}</Text>
              </View>
              <View style={styles.sumDivider} />
              <View style={styles.sumRow}>
                <Text style={styles.sumTotalLabel}>
                  {activeCartType === CART_TYPES.PREORDER
                    ? "Tổng giá trị sản phẩm"
                    : "Tổng cần thanh toán"}
                </Text>
                <Text style={styles.sumTotalValue}>
                  {formatVND(
                    activeCartType === CART_TYPES.PREORDER ? grandTotal : total,
                  )}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!canCheckout || isQuoting}
              style={[styles.checkoutBtn, (!canCheckout || isQuoting) && styles.checkoutBtnDisabled]}
              onPress={proceedCheckout}
            >
              <Text style={[styles.checkoutText, (!canCheckout || isQuoting) && styles.checkoutTextDisabled]}>
                {isQuoting ? "Đang lấy báo giá..." : "Tiến hành thanh toán"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate("Tabs", {
                  screen: "ProductsTab",
                  params: { screen: "Products" },
                })
              }
              style={styles.continueBtn}
            >
              <Text style={styles.continueText}>Tiếp tục mua sắm</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

      <CartItemEditModal
        visible={Boolean(editingItem)}
        cartItem={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(patch) => {
          if (!editingItem) return;
          saveEdit(editingItem, patch);
        }}
      />
    </SafeAreaView>
  );
}

function CartItemCard({ ci, onDec, onInc, onRemove, onEdit, onCombine }) {
  const p = ci.product || {};
  const unitPrice =
    p?.price ?? p?.pricing?.salePrice ?? p?.pricing?.basePrice ?? ci.unitPrice ?? 0;
  const complete = isCartItemComplete(ci);
  const prescriptionState = ci?.prescriptionState;
  const orderTypeLabel = productRequiresLensRxFlow(p)
    ? prescriptionState?.method === "upload"
      ? "Tải ảnh đơn"
      : "Nhập thông số"
    : ci.orderType === "CUSTOM"
      ? ORDER_TYPE_LABEL.CUSTOM
      : ci.isPreorder
        ? ORDER_TYPE_LABEL.PREORDER
        : "Mua ngay";
  const lensStatus = productRequiresLensRxFlow(p)
    ? prescriptionState?.summary?.shortLabel || null
    : null;

  const payNow = calcLineTotal(ci);
  const payLater = calcLinePayLater(ci);
  const full = calcLineTotalFull(ci);
  const depositPercent = getDepositPercent(ci);

  const pairedLabel = ci.combineWithName ? `Đã kết hợp: ${ci.combineWithName}` : null;

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTopRow}>
        {p.image ? (
          <Image source={{ uri: p.image }} style={styles.itemImage} />
        ) : (
          <View style={[styles.itemImage, { alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="image-outline" size={24} color="#9CA3AF" />
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.itemName, { flex: 1 }]} numberOfLines={2}>
              {p.name || ci.name || "Sản phẩm"}
            </Text>

            {onCombine ? (
              <TouchableOpacity
                style={styles.combineBtn}
                activeOpacity={0.85}
                onPress={onCombine}
              >
                <Ionicons name="link-outline" size={15} color="#2563EB" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.editBtn}
              activeOpacity={0.85}
              onPress={onEdit}
            >
              <Ionicons name="pencil" size={13} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {ci.variantText ? <Text style={styles.variantText}>{ci.variantText}</Text> : null}
          {pairedLabel ? <Text style={[styles.variantText, { marginTop: 6 }]}>{pairedLabel}</Text> : null}

          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: "#F3F4F6" }]}>
              <Text style={[styles.pillText, { color: "#374151" }]}>
                {p.displayLabel || "Sản phẩm"}
              </Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{orderTypeLabel}</Text>
            </View>

            {ci.isPreorder ? (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View style={[styles.pill, { backgroundColor: "#FFF7ED" }]}>
                  <Text style={[styles.pillText, { color: "#B45309" }]}>
                    Cọc {formatPercent(depositPercent)}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: "#E8F5E9" }]}>
                  <Text style={[styles.pillText, { color: "green" }]}>Đặt trước</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceRed}>{formatVND(unitPrice)}</Text>
            {p.originalPrice ? <Text style={styles.priceOld}>{formatVND(p.originalPrice)}</Text> : null}
          </View>

          {ci.isPreorder ? (
            <Text style={[styles.variantText, { marginTop: 6, color: "#B45309" }]}>
              Trả trước: {formatVND(payNow)} • COD: {formatVND(payLater)} • Tổng: {formatVND(full)}
            </Text>
          ) : null}

          {productRequiresLensRxFlow(p) ? (
            <Text style={[styles.variantText, { marginTop: 8, color: complete ? "#159947" : "#EF4444" }]}>
              {lensStatus}
            </Text>
          ) : null}

          {productRequiresLensRxFlow(p) && prescriptionState?.summary?.lines?.length ? (
            <View style={{ marginTop: 6, gap: 4 }}>
              {prescriptionState.summary.lines.map((line) => (
                <Text key={`${ci.key}-${line}`} style={styles.variantText}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}

          {ci.readyNote ? (
            <Text style={[styles.variantText, { marginTop: 6 }]}>Ghi chú: {ci.readyNote}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.configActionsRow}>
        <View style={styles.qtyWrap}>
          <TouchableOpacity style={styles.qtyBtn} onPress={onDec} activeOpacity={0.85}>
            <Text style={styles.qtyBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{ci.qty || 1}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={onInc} activeOpacity={0.85}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightBtns}>
          <TouchableOpacity style={styles.removeBtn} activeOpacity={0.85} onPress={onRemove}>
            <Text style={styles.removeText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  cartTypeSwitch: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    padding: 4,
    gap: 6,
    marginBottom: 12,
  },
  cartTypeBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartTypeBtnActive: { backgroundColor: "#FFFFFF" },
  cartTypeText: { fontSize: 13, fontWeight: "800", color: "#6B7280" },
  cartTypeTextActive: { color: "#111827" },

  tabBadge: {
    position: "absolute",
    top: -5,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  tabBadgeText: { fontSize: 10, fontWeight: "900", color: "#FFFFFF", lineHeight: 13 },

  emptyBox: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "#fff",
    borderRadius: 18,
  },
  emptyTitle: { marginTop: 10, fontSize: 14, fontWeight: "900", color: "#111827" },
  goShopBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },
  goShopText: { color: "#fff", fontWeight: "900" },

  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  itemTopRow: { flexDirection: "row", alignItems: "flex-start" },
  itemImage: { width: 74, height: 58, borderRadius: 12, backgroundColor: "#F3F4F6" },

  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  combineBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#E9F1FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemName: { fontSize: 14, fontWeight: "900", color: "#111827" },
  variantText: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },

  pillRow: { marginTop: 8, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#E9F1FF",
    borderRadius: 999,
  },
  pillText: { color: "#2563EB", fontSize: 12, fontWeight: "900" },

  priceRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  priceRed: { color: "#EF4444", fontWeight: "900", fontSize: 14 },
  priceOld: {
    color: "#9CA3AF",
    fontWeight: "800",
    fontSize: 12,
    textDecorationLine: "line-through",
  },

  configActionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 16, fontWeight: "900", color: "#111827" },
  qtyValue: { width: 18, textAlign: "center", fontWeight: "900", color: "#111827" },

  rightBtns: { flexDirection: "row", alignItems: "center", gap: 10 },
  removeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  removeText: { fontSize: 12.5, fontWeight: "900", color: "#EF4444" },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 4,
  },
  warnBar: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  warnIconWrap: { width: 22, alignItems: "center" },
  warnText: { flex: 1, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },

  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  sumLabel: { fontSize: 13, fontWeight: "800", color: "#6B7280" },
  sumValue: { fontSize: 13, fontWeight: "900", color: "#111827" },
  sumDivider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 6 },
  sumTotalLabel: { fontSize: 13.5, fontWeight: "900", color: "#111827" },
  sumTotalValue: { fontSize: 14, fontWeight: "900", color: "#EF4444" },

  checkoutBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBtnDisabled: { backgroundColor: "#E5E7EB" },
  checkoutText: { color: "#FFFFFF", fontWeight: "900" },
  checkoutTextDisabled: { color: "#9CA3AF" },

  continueBtn: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#2563EB",
    borderWidth: 2,
  },
  continueText: {
    textAlign: "center",
    color: "#2563EB",
    fontWeight: "900",
  },
});
