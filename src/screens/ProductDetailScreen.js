import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";

import { addMyFavoriteApi, getMyFavoriteIdsApi, removeMyFavoriteApi } from "../services/userService";
import { useProducts } from "../hooks/useProducts";
import { getRelatedProducts, fetchProductById } from "../services/productService";
import { CART_TYPES } from "../store/cartStore";
import {
  API_CART_TYPES,
  getMyCartApi,
  changeCartBadgeQty,
  upsertCartItemApi,
} from "../services/cartService";
import CartIconButton from "../components/CartIconButton";
import ProductCard from "../components/ProductCard";
import { useAuthStore } from "../store/authStore";
import ProductModelViewer from "../components/ProductModelViewer";

/* -------------------- helpers -------------------- */

const formatVND = (v) => new Intl.NumberFormat("vi-VN").format(v) + "đ";

const calcDiscountPct = (price, originalPrice) => {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};

const ORDER_TYPES = {
  READY: "Nhận thông số",
  PREORDER: "Đặt trước",
  CUSTOM: "Làm theo đơn",
};

const TRY_ON_STATUS_LABEL = {
  draft: "Try-on chưa được publish",
  pending_review: "Try-on đang chờ duyệt",
  approved: "Try-on đã duyệt, chờ phát hành",
  published: "Try-on đã sẵn sàng",
  rejected: "Try-on cần cập nhật lại",
  archived: "Try-on đã lưu trữ",
};

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const MODEL_FILE_PATTERN = /\.(glb|gltf|usdz)(\?|#|$)/i;

const UI_TO_API_CART_TYPE = {
  [CART_TYPES.ORDER]: API_CART_TYPES.READY_STOCK,
  [CART_TYPES.PREORDER]: API_CART_TYPES.PRE_ORDER,
};

function normalizeStr(s) {
  return String(s ?? "").trim().toLowerCase();
}

function canUseAbsoluteHttpUrl(value) {
  return ABSOLUTE_URL_PATTERN.test(String(value ?? "").trim());
}

function isModelFileUrl(value) {
  return MODEL_FILE_PATTERN.test(String(value ?? "").trim());
}

function isWebTryOnUrl(value) {
  return canUseAbsoluteHttpUrl(value) && !isModelFileUrl(value);
}

function toIdString(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value._id != null) return toIdString(value._id);
    if (value.id != null) return toIdString(value.id);
    if (typeof value.toString === "function") {
      const text = String(value.toString());
      if (text && text !== "[object Object]") return text;
    }
  }
  return "";
}

function pick2DAsset(assets = []) {
  return (
    assets.find((a) => a?.assetType === "2d" && a?.role === "hero") ||
    assets.find((a) => a?.assetType === "2d" && a?.role === "gallery") ||
    assets.find((a) => a?.assetType === "2d" && a?.role === "thumbnail") ||
    assets.find((a) => a?.assetType === "2d" && a?.role === "lifestyle") ||
    assets.find((a) => a?.assetType === "2d") ||
    null
  );
}

function pick3DAsset(assets = []) {
  return (
    assets.find((a) => a?.assetType === "3d" && a?.role === "viewer") ||
    assets.find((a) => a?.assetType === "3d" && a?.role === "try_on") ||
    assets.find((a) => a?.assetType === "3d") ||
    null
  );
}

function getVariantAssets(product, variant) {
  const variantId = toIdString(variant?._id || variant?.id);
  if (!variantId) return [];
  const byVariant = product?.media?.byVariant;
  const assets = byVariant?.[variantId];
  return Array.isArray(assets) ? assets : [];
}

function getSelectedVariant(product, { colorId, size }) {
  if (!product?.variants?.length) return null;

  const colorObj = product.colors?.find((c) => c.id === colorId);
  const colorKey = colorObj?.name || colorObj?.label || colorObj?.id || null;

  return (
    product.variants.find((v) => {
      const opts = v?.options || {};
      const hasColor = Object.prototype.hasOwnProperty.call(opts, "color");
      const hasSize = Object.prototype.hasOwnProperty.call(opts, "size");

      const vColor = opts.color ?? null;
      const vSize = opts.size ?? null;

      const okColor = colorKey ? normalizeStr(vColor) === normalizeStr(colorKey) : true;
      const okSize = size ? normalizeStr(vSize) === normalizeStr(size) : true;

      return (hasColor ? okColor : true) && (hasSize ? okSize : true);
    }) || null
  );
}

function isRxFilled(rxOD, rxOS) {
  const okOD = Boolean(rxOD?.CYL) && Boolean(rxOD?.AXIS);
  const okOS = Boolean(rxOS?.CYL) && Boolean(rxOS?.AXIS);
  return okOD && okOS;
}

function normType(t) {
  return String(t ?? "").trim().toUpperCase();
}

function getOppositeTypeList(products, product, limit = 10) {
  if (!product) return [];
  const t = normType(product.type);

  if (t !== "FRAME" && t !== "LENS") return [];

  const targetType = t === "FRAME" ? "LENS" : "FRAME";
  const curId = String(product.apiId || product._id || product.id || "");

  return (products || [])
    .filter((p) => normType(p.type) === targetType)
    .filter((p) => String(p.apiId || p._id || p.id || "") !== curId)
    .slice(0, limit);
}

function pickIds(maybe) {
  if (!Array.isArray(maybe)) return [];
  return maybe
    .map((x) => (typeof x === "string" ? x : x?._id || x?.id || null))
    .filter(Boolean);
}

function getCompatibilityIds(product) {
  const p = product || {};
  const specs = p.specs || {};

  const lensIds =
    pickIds(p.compatibleLensIds) ||
    pickIds(p.compatibility?.lensIds) ||
    pickIds(specs.compatibility?.lensIds) ||
    pickIds(specs?.common?.compatibleLensIds) ||
    [];

  const frameIds =
    pickIds(p.compatibleFrameIds) ||
    pickIds(p.compatibility?.frameIds) ||
    pickIds(specs.compatibility?.frameIds) ||
    pickIds(specs?.common?.compatibleFrameIds) ||
    [];

  const withIds = pickIds(p.compatibleWithIds) || pickIds(specs?.common?.compatibleWithIds) || [];

  return {
    lensIds: lensIds.length ? lensIds : [],
    frameIds: frameIds.length ? frameIds : [],
    withIds: withIds.length ? withIds : [],
  };
}

function getCompatibleProducts(products, product) {
  if (!product) return [];
  const type = normType(product.type);

  if (type !== "FRAME" && type !== "LENS") return [];

  const { lensIds, frameIds, withIds } = getCompatibilityIds(product);
  const targetType = type === "FRAME" ? "LENS" : "FRAME";
  const targetIds = type === "FRAME" ? lensIds : frameIds;
  const idsToUse = targetIds.length ? targetIds : withIds;

  if (!idsToUse.length) return [];

  const idSet = new Set(idsToUse.map(String));

  return (products || [])
    .filter((p) => normType(p.type) === targetType)
    .filter((p) => {
      const pid = String(p.apiId || p._id || p.id || "");
      return idSet.has(pid);
    });
}

function buildCartCustomization({
  product,
  orderType,
  colorId,
  size,
  readyNote,
  rxOD,
  rxOS,
  rxPhoto,
}) {
  const colorObj = product?.colors?.find((x) => x.id === colorId);

  const customization = {
    selectedColor: colorObj?.name || colorObj?.label || colorId || undefined,
    selectedSize: size || undefined,
    note: readyNote || undefined,
  };

  if (product?.type === "LENS") {
    if (orderType === "READY") {
      customization.prescription = {
        mode: "manual",
        rightEye: {
          cyl: rxOD?.CYL || "",
          axis: rxOD?.AXIS || "",
        },
        leftEye: {
          cyl: rxOS?.CYL || "",
          axis: rxOS?.AXIS || "",
        },
      };
    }

    if (orderType === "CUSTOM" && rxPhoto?.uri) {
      customization.prescription = {
        mode: "attachment",
        attachmentUrls: [rxPhoto.uri],
      };
    }
  }

  return customization;
}

function buildCartItemPayload({
  product,
  qty,
  colorId,
  size,
  readyNote,
  orderType,
  rxOD,
  rxOS,
  rxPhoto,
  selectedVariant,
}) {
  return {
    productId: String(product?.apiId || product?._id || product?.id || ""),
    variantId: selectedVariant?._id || selectedVariant?.id || undefined,
    quantity: qty || 1,
    customization: buildCartCustomization({
      product,
      orderType,
      colorId,
      size,
      readyNote,
      rxOD,
      rxOS,
      rxPhoto,
    }),
  };
}

/* -------------------- Screen -------------------- */

export default function ProductDetailScreen({ navigation, route }) {
  const token = useAuthStore((s) => s.token);
  const passedItem = route?.params?.item;
  const passedId = route?.params?.id || route?.params?.productId;

  const { products } = useProducts();
  const [specsOpen, setSpecsOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const requireLogin = () => {
    Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập để sử dụng tính năng này.", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng nhập", onPress: () => navigation.navigate("Login") },
    ]);
  };

  const fallbackFromList = useMemo(() => {
    if (!passedId) return null;
    return products.find((p) => p.id === passedId) || null;
  }, [passedId, products]);

  const [product, setProduct] = useState(passedItem ?? fallbackFromList ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fav, setFav] = useState(false);

  const apiId = useMemo(() => {
    return passedItem?.apiId || passedItem?._id || passedId || null;
  }, [passedItem, passedId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!token || !product?.id) {
        if (mounted) setFav(false);
        return;
      }

      try {
        const ids = await getMyFavoriteIdsApi();
        const normalized = Array.isArray(ids) ? ids.map(String) : [];
        if (mounted) setFav(normalized.includes(String(product.id)));
      } catch {
        if (mounted) setFav(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token, product?.id]);

  useEffect(() => {
    let mounted = true;
    if (!apiId) return;

    (async () => {
      try {
        setIsRefreshing(true);
        const fresh = await fetchProductById(apiId);
        if (mounted && fresh) setProduct(fresh);
      } catch (e) {
      } finally {
        if (mounted) setIsRefreshing(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiId]);

  const discountPct = useMemo(() => {
    if (!product) return 0;
    return product.discountPct ?? calcDiscountPct(product.price, product.originalPrice);
  }, [product]);

  const headerTitle =
    product?.type === "LENS"
      ? "Chi tiết tròng kính"
      : product?.type === "FRAME"
        ? "Chi tiết gọng kính"
        : "Chi tiết sản phẩm";

  const [orderType, setOrderType] = useState("READY");
  const [colorId, setColorId] = useState(product?.colors?.[0]?.id ?? null);
  const [size, setSize] = useState(product?.type === "FRAME" ? product?.sizes?.[0] ?? "M" : "STD");
  const [qty, setQty] = useState(1);
  const [readyNote, setReadyNote] = useState("");
  const [mediaMode, setMediaMode] = useState("2d");

  useEffect(() => {
    if (!product) return;

    setQty(1);
    setReadyNote("");
    setColorId(product.colors?.[0]?.id ?? null);
    setMediaMode("2d");

    if (product.type === "FRAME") {
      setSize(product.sizes?.[0] || "M");
    } else {
      setSize("STD");
    }
  }, [product]);

  const [rxOD, setRxOD] = useState({ CYL: "", AXIS: "" });
  const [rxOS, setRxOS] = useState({ CYL: "", AXIS: "" });
  const [rxPhoto, setRxPhoto] = useState(null);

  const [open, setOpen] = useState({
    desc: false,
    sizeGuide: false,
    reviews: false,
    qa: false,
  });

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    if (product.type === "FRAME") return getSelectedVariant(product, { colorId, size });
    return getSelectedVariant(product, { colorId, size: null });
  }, [product, colorId, size]);

  const variantAssets = useMemo(
    () => getVariantAssets(product, selectedVariant),
    [product, selectedVariant]
  );

  const fallbackColorImage = useMemo(() => {
    if (!product || product.type !== "FRAME") return null;
    const c = product.colors?.find((x) => x.id === colorId);
    return c?.imageOverride || null;
  }, [product, colorId]);

  const image2DAsset = useMemo(() => {
    return pick2DAsset(variantAssets) || pick2DAsset(product?.media?.assets || []);
  }, [variantAssets, product?.media?.assets]);

  const image3DAsset = useMemo(() => {
    return (
      pick3DAsset(variantAssets) ||
      pick3DAsset(product?.media?.tryOn?.assets || []) ||
      pick3DAsset(product?.media?.assets || []) ||
      product?.model3D?.defaultAsset ||
      null
    );
  }, [variantAssets, product?.media?.tryOn?.assets, product?.media?.assets, product?.model3D?.defaultAsset]);

  const model3DUrl = useMemo(() => {
    return (
      image3DAsset?.ar?.glbUrl ||
      image3DAsset?.url ||
      product?.model3D?.glbUrl ||
      product?.tryOn?.glbUrl ||
      ""
    );
  }, [image3DAsset, product]);

  const has3DAsset = Boolean(image3DAsset);

  useEffect(() => {
    if (!has3DAsset && mediaMode !== "2d") {
      setMediaMode("2d");
    }
  }, [has3DAsset, mediaMode]);

  const mainImage = useMemo(() => {
    if (!product) return null;
    if (mediaMode === "3d" && has3DAsset) {
      return (
        image3DAsset?.posterUrl ||
        image3DAsset?.url ||
        image2DAsset?.url ||
        fallbackColorImage ||
        product.image
      );
    }
    return image2DAsset?.url || fallbackColorImage || product.image;
  }, [product, mediaMode, has3DAsset, image3DAsset, image2DAsset, fallbackColorImage]);

  const related = useMemo(() => {
    if (!product) return [];
    return getRelatedProducts(products, product);
  }, [product, products]);

  const compatibleItems = useMemo(() => {
    if (!product) return [];
    return getOppositeTypeList(products, product, 10);
  }, [products, product]);

  const minQty = product?.qtyLimits?.min ?? 1;
  const maxQty = product?.qtyLimits?.max ?? 99;

  const incQty = () => setQty((q) => Math.min(maxQty, q + 1));
  const decQty = () => setQty((q) => Math.max(minQty, q - 1));

  const onToggleAccordion = (key) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const variantStock = selectedVariant?.stock ?? product?.totalStock ?? 0;
  const isVariantOut = variantStock <= 0;
  const preorderEnabled = product?.preOrder?.enabled === true;
  const isPreorderMode = isVariantOut && preorderEnabled;
  const showPreorder = isPreorderMode;

  const orderTypeItems = useMemo(
    () => [
      { key: "READY", label: ORDER_TYPES.READY },
      { key: "CUSTOM", label: ORDER_TYPES.CUSTOM },
    ],
    []
  );

  const canBuy = useMemo(() => {
    if (!product) return false;
    if (isVariantOut && !preorderEnabled) return false;
    return true;
  }, [product, isVariantOut, preorderEnabled]);

  useEffect(() => {
    if (!product) return;
    if (!orderType || (orderType !== "READY" && orderType !== "CUSTOM")) {
      setOrderType("READY");
    }
  }, [product?.id]);

  const pickRxPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Thiếu quyền", "Vui lòng cấp quyền truy cập ảnh.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled) {
      const a = res.assets?.[0];
      if (a?.uri) setRxPhoto({ uri: a.uri, name: "rx.jpg", type: "image/jpeg" });
    }
  }, []);

  const hasFrameInCart = async () => {
    try {
      const [readyCart, preorderCart] = await Promise.all([
        getMyCartApi(API_CART_TYPES.READY_STOCK),
        getMyCartApi(API_CART_TYPES.PRE_ORDER),
      ]);

      const readyItems = Array.isArray(readyCart?.items) ? readyCart.items : [];
      const preorderItems = Array.isArray(preorderCart?.items) ? preorderCart.items : [];

      return [...readyItems, ...preorderItems].some(
        (x) => String(x?.type || "").toUpperCase() === "FRAME"
      );
    } catch {
      return false;
    }
  };

  const doAddToCart = useCallback(async () => {
    if (!product) return false;

    if (product.type === "LENS") {
      const hasRx = isRxFilled(rxOD, rxOS);
      const hasPhoto = Boolean(rxPhoto?.uri);

      if (orderType === "READY" && !hasRx) {
        Alert.alert("Thiếu thông số", "Vui lòng nhập đầy đủ thông số (OD/OS).");
        return false;
      }

      if (orderType === "CUSTOM" && !hasPhoto) {
        Alert.alert("Thiếu ảnh đơn kính", "Vui lòng tải ảnh đơn kính để tiếp tục.");
        return false;
      }
    }

    try {
      const uiCartType = isPreorderMode ? CART_TYPES.PREORDER : CART_TYPES.ORDER;
      const apiCartType = UI_TO_API_CART_TYPE[uiCartType] || API_CART_TYPES.READY_STOCK;

      const payload = buildCartItemPayload({
        product,
        qty,
        colorId,
        size,
        readyNote,
        orderType: isPreorderMode ? "PREORDER" : orderType,
        rxOD,
        rxOS,
        rxPhoto,
        selectedVariant,
      });

      await upsertCartItemApi(apiCartType, payload);
      changeCartBadgeQty(qty);

      Toast.show({
        type: "success",
        text1: isPreorderMode ? "Đã đặt trước" : "Đã thêm vào giỏ",
        text2: product.name,
      });

      return true;
    } catch (err) {
      const data = err?.response?.data || {};
      const errors = Array.isArray(data?.errors)
        ? data.errors.map((e) => e?.msg).filter(Boolean).join("\n")
        : null;
      const message = errors || data?.message || data?.error || err?.message;

      Alert.alert(
        "Không thêm vào giỏ được",
        message || "Đã có lỗi xảy ra. Vui lòng thử lại.",
      );
      return false;
    }
  }, [
    product,
    qty,
    colorId,
    size,
    readyNote,
    orderType,
    rxOD,
    rxOS,
    rxPhoto,
    selectedVariant,
    isPreorderMode,
  ]);

  const onAddToCart = useCallback(async () => {
    if (!token) return requireLogin();
    if (!product || !canBuy) return;

    if (product.type === "LENS" && !(await hasFrameInCart())) {
      Alert.alert(
        "Bạn đang mua tròng riêng",
        "Nếu bạn chưa có gọng phù hợp, bạn có thể thêm gọng để shop hỗ trợ lắp và căn chỉnh tốt hơn.",
        [
          {
            text: isPreorderMode ? "Đặt trước (tròng)" : "Thêm vào giỏ (tròng)",
            onPress: async () => {
              await doAddToCart();
            },
          },
          {
            text: "Chọn thêm gọng",
            onPress: () => navigation.navigate("Tabs", { screen: "ProductsTab" }),
          },
          { text: "Hủy", style: "cancel" },
        ]
      );
      return;
    }

    await doAddToCart();
  }, [token, product, canBuy, doAddToCart, navigation, isPreorderMode]);

  const onBuyNow = async () => {
    if (!token) return requireLogin();

    const ok = await doAddToCart();
    if (!ok) return;

    navigation.navigate("CartFlow", {
      screen: "Cart",
      params: { cartType: isPreorderMode ? CART_TYPES.PREORDER : CART_TYPES.ORDER },
    });
  };

  const onToggleFav = async () => {
    if (!token) return requireLogin();
    if (!product?.id) return;

    const productId = String(product.id);
    const wasFav = fav;

    setFav(!wasFav);

    try {
      if (wasFav) {
        await removeMyFavoriteApi(productId);
      } else {
        await addMyFavoriteApi(productId);
      }

      Toast.show({
        type: "success",
        text1: wasFav ? "Đã bỏ yêu thích" : "Đã thêm yêu thích",
        text2: product.name,
      });
    } catch {
      setFav(wasFav);
    }
  };

  const onOpenTryOn = useCallback(() => {
    const baseTryOn = product?.tryOn;
    const assetFormat = String(image3DAsset?.format || "").trim().toLowerCase();
    const assetUrl = String(image3DAsset?.url || "").trim();
    const assetAr = image3DAsset?.ar && typeof image3DAsset.ar === "object" ? image3DAsset.ar : {};
    const tryOn = {
      ...(baseTryOn || {}),
      glbUrl:
        assetFormat === "glb" || assetFormat === "gltf"
          ? String(assetAr.glbUrl || assetUrl || baseTryOn?.glbUrl || "").trim()
          : String(baseTryOn?.glbUrl || "").trim(),
      usdzUrl:
        assetFormat === "usdz"
          ? String(assetAr.usdzUrl || assetUrl || baseTryOn?.usdzUrl || "").trim()
          : String(baseTryOn?.usdzUrl || "").trim(),
    };
    tryOn.launchUrl =
      (isWebTryOnUrl(baseTryOn?.launchUrl) ? String(baseTryOn?.launchUrl || "").trim() : "") ||
      (isWebTryOnUrl(tryOn.arUrl) ? String(tryOn.arUrl || "").trim() : "");

    if (!tryOn?.ready) {
      Alert.alert("Try-on", "Try-on chưa sẵn sàng cho sản phẩm này.");
      return;
    }

    navigation.navigate("TryOnAR", {
      product: {
        id: product.id,
        apiId: product.apiId,
        name: product.name,
      },
      tryOn,
    });
  }, [image3DAsset, navigation, product]);

  if (!product) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <HeaderBar navigation={navigation} title="Chi tiết sản phẩm" isPreorderMode={isPreorderMode} />
        <View style={{ padding: 16 }}>
          <Text>Không tìm thấy sản phẩm.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ACCORDIONS = [
    { key: "desc", title: "Mô tả sản phẩm", content: product.sections?.description || "—" },
    { key: "sizeGuide", title: "Hướng dẫn chọn size", content: product.sections?.sizeGuide || "—" },
    { key: "reviews", title: `Đánh giá (${product.ratingCount ?? product.ratingsQuantity ?? 0})`, content: "Xem đánh giá..." },
    { key: "qa", title: `Hỏi đáp (${product.qaCount ?? 0})`, content: "Xem Q&A..." },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HeaderBar navigation={navigation} title={headerTitle} isPreorderMode={isPreorderMode} />

      <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.content}>
        {isRefreshing ? (
          <Text style={{ marginTop: 10, fontWeight: "700", color: "#6B7280" }}>
            Đang cập nhật dữ liệu mới nhất...
          </Text>
        ) : null}

        <Hero
          product={product}
          image={mainImage}
          discountPct={discountPct}
          fav={fav}
          onToggleFav={onToggleFav}
          isVariantOut={isVariantOut}
          mediaMode={mediaMode}
          onChangeMediaMode={setMediaMode}
          has3D={has3DAsset}
          model3DUrl={model3DUrl}
          onOpenPreview={() => setPreviewOpen(true)}
        />

        <InfoCard product={product} discountPct={discountPct} isVariantOut={isVariantOut} variantStock={variantStock} />

        {product.type === "FRAME" && product?.tryOn?.enabled ? (
          <TryOnCard tryOn={product.tryOn} onOpenTryOn={onOpenTryOn} />
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Loại đơn hàng</Text>

          <Segmented items={orderTypeItems} value={orderType} onChange={setOrderType} />

          <Text style={styles.mutedText}>
            {showPreorder
              ? "Sản phẩm bạn chọn hiện hết hàng — bạn có thể đặt trước."
              : product.shipping?.etaLabel || "Giao nhanh 1–3 ngày"}
          </Text>
        </Card>

        {product.type === "LENS" ? (
          <LensOptions
            product={product}
            colorId={colorId}
            setColorId={setColorId}
            orderType={orderType}
            rxOD={rxOD}
            rxOS={rxOS}
            setRxOD={setRxOD}
            setRxOS={setRxOS}
            rxPhoto={rxPhoto}
            pickRxPhoto={pickRxPhoto}
            canBuy={canBuy}
            onAdd={onAddToCart}
            onBuyNow={onBuyNow}
            isPreorderMode={isPreorderMode}
            qty={qty}
            incQty={incQty}
            decQty={decQty}
          />
        ) : (
          <FrameOptions
            product={product}
            orderType={orderType}
            readyNote={readyNote}
            setReadyNote={setReadyNote}
            colorId={colorId}
            setColorId={setColorId}
            size={size}
            setSize={setSize}
            qty={qty}
            incQty={incQty}
            decQty={decQty}
            canBuy={canBuy}
            onAdd={onAddToCart}
            onBuyNow={onBuyNow}
            isVariantOut={isVariantOut}
            isPreorderMode={isPreorderMode}
          />
        )}

        <SpecsCard specs={product.specs || []} open={specsOpen} onToggle={() => setSpecsOpen((p) => !p)} />

        {ACCORDIONS.map((a) => (
          <Accordion
            key={a.key}
            title={a.title}
            open={open[a.key]}
            onToggle={() => onToggleAccordion(a.key)}
            content={<Text style={styles.accText}>{a.content}</Text>}
          />
        ))}

        {(normType(product.type) === "FRAME" || normType(product.type) === "LENS") ? (
          <CompatibleList
            navigation={navigation}
            items={compatibleItems}
            title={normType(product.type) === "FRAME" ? "Tròng kính gợi ý" : "Gọng kính gợi ý"}
          />
        ) : null}

        <RelatedList navigation={navigation} related={related} />
        <HeroPreviewModal
          visible={previewOpen}
          onClose={() => setPreviewOpen(false)}
          mediaMode={mediaMode}
          image={mainImage}
          model3DUrl={model3DUrl}
        />
        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- Components -------------------- */

function HeaderBar({ navigation, title, isPreorderMode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity
          onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
          activeOpacity={0.8}
          style={styles.headerIconBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate("Tabs", {
              screen: "FavTab",
              params: { screen: "Favorites" },
            })
          }
        >
          <Ionicons name="heart" size={24} color="#EF4444" />
        </TouchableOpacity>

        <CartIconButton
          onPress={() =>
            navigation.navigate("CartFlow", {
              screen: "Cart",
              params: { cartType: isPreorderMode ? CART_TYPES.PREORDER : CART_TYPES.ORDER },
            })
          }
        />
      </View>
    </View>
  );
}

function Hero({
  product,
  image,
  discountPct,
  fav,
  onToggleFav,
  isVariantOut,
  mediaMode = "2d",
  onChangeMediaMode,
  has3D,
  model3DUrl,
  onOpenPreview,
}) {
  const isOutOfStock = isVariantOut;

  return (
    <Card style={styles.heroCard}>
      <View style={styles.heroImageWrap}>
        {discountPct > 0 && !isOutOfStock ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{discountPct}%</Text>
          </View>
        ) : null}

        {isOutOfStock ? (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Hết hàng</Text>
          </View>
        ) : product.status ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{product.status}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onToggleFav}
          style={styles.favBtnOnImage}
        >
          <Ionicons
            name={fav ? "heart" : "heart-outline"}
            size={20}
            color="#EF4444"
          />
        </TouchableOpacity>

        {mediaMode === "3d" && has3D && model3DUrl ? (
          <View style={[styles.heroImage, isOutOfStock && styles.heroImageDisabled]}>
            <ProductModelViewer
              glbUrl={model3DUrl}
              scale={[4.5, 4.5, 4.5]}
              position={[0, -10, 0]}
              cameraZ={95}
              style={styles.heroModelViewer}
            />
          </View>
        ) : image ? (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={onOpenPreview}
            style={styles.heroImage}
          >
            <Image
              source={{ uri: image }}
              style={[styles.heroImage, isOutOfStock && styles.heroImageDisabled]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : null}

        {mediaMode === "3d" && has3D && model3DUrl ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onOpenPreview}
            style={styles.expand3DBtn}
          >
            <Ionicons name="expand-outline" size={16} color="#111827" />
            <Text style={styles.expand3DBtnText}>Phóng to</Text>
          </TouchableOpacity>
        ) : null}

        {product.type === "FRAME" && has3D && !isOutOfStock ? (
          <View style={styles.modeSwitchWrap}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onChangeMediaMode?.("2d")}
              style={[
                styles.modeSwitchItem,
                mediaMode === "2d" && styles.modeSwitchItemActive,
              ]}
            >
              <Text
                style={[
                  styles.modeSwitchText,
                  mediaMode === "2d" && styles.modeSwitchTextActive,
                ]}
              >
                2D
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onChangeMediaMode?.("3d")}
              style={[
                styles.modeSwitchItem,
                mediaMode === "3d" && styles.modeSwitchItemActive,
              ]}
            >
              <Text
                style={[
                  styles.modeSwitchText,
                  mediaMode === "3d" && styles.modeSwitchTextActive,
                ]}
              >
                3D
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function HeroPreviewModal({
  visible,
  onClose,
  mediaMode,
  image,
  model3DUrl,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <View style={styles.previewOverlay}>
        <Pressable style={styles.previewBackdrop} onPress={onClose} />

        <View style={styles.previewContentWrap} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onClose}
            style={styles.previewCloseBtn}
          >
            <Ionicons name="close" size={22} color="#111827" />
          </TouchableOpacity>

          <View style={styles.previewCard}>
            {mediaMode === "3d" && model3DUrl ? (
              <ProductModelViewer
                key={`preview-3d-${model3DUrl}-${visible ? "open" : "close"}`}
                glbUrl={model3DUrl}
                scale={[3.8, 3.8, 3.8]}
                cameraZ={135}
                position={[0, -2, 0]}
                style={styles.previewModelViewer}
              />
            ) : image ? (
              <Image
                source={{ uri: image }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoCard({ product, discountPct, isVariantOut, variantStock }) {
  const isOutOfStock = isVariantOut;

  const ratingAvg =
    typeof product.ratingAvg === "number"
      ? product.ratingAvg
      : typeof product.ratingsAverage === "number"
        ? product.ratingsAverage
        : null;

  const ratingCount = product.ratingCount ?? product.ratingsQuantity ?? 0;

  return (
    <Card>
      <Text style={styles.name}>{product.name}</Text>

      <View style={styles.metaRow}>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.ratingText}>{ratingAvg != null ? ratingAvg.toFixed(1) : "4.7"}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.metaText}>{ratingCount} đánh giá</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.metaText}>Đã bán {product.soldCount ?? 0}</Text>
        </View>

        {isOutOfStock ? (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockBadgeText}>Hết hàng</Text>
          </View>
        ) : product.stockLabel ? (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>{product.stockLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.price, isOutOfStock && styles.priceDisabled]}>
          {formatVND(product.price ?? product.pricing?.salePrice ?? product.pricing?.basePrice ?? 0)}
        </Text>
        {product.originalPrice ? <Text style={styles.originalPrice}>{formatVND(product.originalPrice)}</Text> : null}
        {discountPct > 0 && !isOutOfStock ? (
          <View style={styles.offBadge}>
            <Text style={styles.offBadgeText}>-{discountPct}%</Text>
          </View>
        ) : null}
      </View>

      {!isOutOfStock && variantStock > 0 ? <Text style={styles.stockInfo}>Còn {variantStock} sản phẩm</Text> : null}
    </Card>
  );
}

function LensOptions({
  product,
  colorId,
  setColorId,
  orderType,
  rxOD,
  rxOS,
  setRxOD,
  setRxOS,
  rxPhoto,
  pickRxPhoto,
  canBuy,
  onAdd,
  onBuyNow,
  isPreorderMode,
  qty,
  incQty,
  decQty,
}) {
  const hasColors = Array.isArray(product?.colors) && product.colors.length > 0;
  return (
    <Card>
      {hasColors ? (
        <>
          <Text style={styles.sectionTitle}>Màu sắc</Text>
          <View style={styles.colorRow}>
            {(product.colors || []).map((c) => {
              const active = c.id === colorId;
              return (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.85}
                  onPress={() => setColorId(c.id)}
                  style={[styles.colorDotWrap, active && styles.colorDotWrapActive]}
                >
                  <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { marginTop: hasColors ? 14 : 0 }]}>Thông số</Text>

      {orderType === "READY" ? (
        <>
          <Text style={styles.eyeLabel}>Mắt phải (OD)</Text>
          <View style={styles.rxRow}>
            <RxInput
              label="CYL"
              placeholder="0.00"
              value={rxOD.CYL}
              onChangeText={(t) => setRxOD((p) => ({ ...p, CYL: t }))}
            />
            <RxInput
              label="AXIS"
              placeholder="0"
              value={rxOD.AXIS}
              onChangeText={(t) => setRxOD((p) => ({ ...p, AXIS: t }))}
            />
          </View>

          <Text style={[styles.eyeLabel, { marginTop: 10 }]}>Mắt trái (OS)</Text>
          <View style={styles.rxRow}>
            <RxInput
              label="CYL"
              placeholder="0.00"
              value={rxOS.CYL}
              onChangeText={(t) => setRxOS((p) => ({ ...p, CYL: t }))}
            />
            <RxInput
              label="AXIS"
              placeholder="0"
              value={rxOS.AXIS}
              onChangeText={(t) => setRxOS((p) => ({ ...p, AXIS: t }))}
            />
          </View>
        </>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.mutedText}>
            {isPreorderMode
              ? "Sản phẩm hết hàng. Bạn đang đặt trước — Vui lòng cung cấp thông tin theo lựa chọn dưới đây."
              : orderType === "CUSTOM"
                ? "Làm theo đơn: Vui lòng tải ảnh đơn kính do bác sĩ cung cấp."
                : ""}
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.outlineBtn, { width: "100%", marginTop: 10 }]}
            onPress={pickRxPhoto}
          >
            <Text style={styles.outlineBtnText}>{rxPhoto?.uri ? "Đổi ảnh đơn kính" : "Tải ảnh đơn kính"}</Text>
          </TouchableOpacity>

          {rxPhoto?.uri ? <Text style={styles.mutedText}>Đã chọn ảnh</Text> : null}
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Số lượng</Text>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} activeOpacity={0.85} onPress={decQty}>
          <Text style={styles.qtyBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{qty}</Text>
        <TouchableOpacity style={styles.qtyBtn} activeOpacity={0.85} onPress={incQty}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <CTAButtons canBuy={canBuy} onAdd={onAdd} onBuyNow={onBuyNow} isPreorder={isPreorderMode} />
    </Card>
  );
}

function TryOnCard({ tryOn, onOpenTryOn }) {
  const status = String(tryOn?.status || "").trim().toLowerCase();
  const statusLabel = TRY_ON_STATUS_LABEL[status] || "Không có trạng thái try-on";
  const canOpen = Boolean(tryOn?.ready);

  return (
    <Card>
      <View style={styles.tryOnHeader}>
        <View style={styles.tryOnTitleWrap}>
          <Ionicons name="glasses-outline" size={18} color="#111827" />
          <Text style={styles.sectionTitle}>Virtual Try-On</Text>
        </View>
        <View style={[styles.tryOnStatusPill, canOpen ? styles.tryOnStatusPillReady : styles.tryOnStatusPillPending]}>
          <Text style={[styles.tryOnStatusText, canOpen ? styles.tryOnStatusTextReady : styles.tryOnStatusTextPending]}>
            {canOpen ? "Sẵn sàng" : "Chưa sẵn sàng"}
          </Text>
        </View>
      </View>

      <Text style={styles.tryOnHint}>{statusLabel}</Text>

      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!canOpen}
        onPress={onOpenTryOn}
        style={[styles.tryOnButton, !canOpen && styles.btnDisabled]}
      >
        <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
        <Text style={[styles.tryOnButtonText, !canOpen && styles.btnDisabledText]}>
          {canOpen ? "Mở Try-On" : "Try-On chưa khả dụng"}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

function FrameOptions({
  product,
  orderType,
  readyNote,
  setReadyNote,
  colorId,
  setColorId,
  size,
  setSize,
  qty,
  incQty,
  decQty,
  canBuy,
  onAdd,
  onBuyNow,
  isVariantOut,
  isPreorderMode,
}) {
  const hasColors = Array.isArray(product?.colors) && product.colors.length > 0;
  const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;

  return (
    <Card>
      {isPreorderMode && (
        <View style={styles.outOfStockInfoBox}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.outOfStockInfoText}>
            Sản phẩm bạn chọn hiện đang hết hàng — bạn vẫn có thể nhập số lượng và bấm "Đặt trước".
          </Text>
        </View>
      )}

      {hasColors && (
        <>
          <Text style={styles.sectionTitle}>Màu sắc</Text>
          <View style={styles.colorRow}>
            {(product.colors || []).map((c) => {
              const active = c.id === colorId;
              return (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.85}
                  onPress={() => setColorId(c.id)}
                  style={[styles.colorDotWrap, active && styles.colorDotWrapActive]}
                >
                  <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {hasSizes && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Kích thước</Text>
          <View style={styles.sizeRow}>
            {(product.sizes || []).map((s) => {
              const active = s === size;
              return (
                <TouchableOpacity
                  key={s}
                  activeOpacity={0.85}
                  onPress={() => setSize(s)}
                  style={[styles.sizePill, active && styles.sizePillActive]}
                >
                  <Text style={[styles.sizeText, active && styles.sizeTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Số lượng</Text>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} activeOpacity={0.85} onPress={decQty}>
          <Text style={styles.qtyBtnText}>-</Text>
        </TouchableOpacity>

        <Text style={styles.qtyValue}>{qty}</Text>

        <TouchableOpacity style={styles.qtyBtn} activeOpacity={0.85} onPress={incQty}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {orderType === "READY" ? (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.sectionTitle}>Thông số / Ghi chú</Text>
          <TextInput
            value={readyNote}
            onChangeText={setReadyNote}
            placeholder="Nhập ghi chú hoặc thông số bạn muốn cung cấp..."
            placeholderTextColor="#9AA4B2"
            style={styles.noteInput}
            multiline
          />
        </View>
      ) : null}

      <CTAButtons canBuy={canBuy} onAdd={onAdd} onBuyNow={onBuyNow} isPreorder={isPreorderMode} />
    </Card>
  );
}

function CTAButtons({ canBuy, onAdd, onBuyNow, isPreorder }) {
  const addLabel = isPreorder ? "Đặt trước" : "Thêm vào giỏ";
  const buyLabel = isPreorder ? "Đặt trước ngay" : "Mua ngay";

  return (
    <View style={styles.ctaRow}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!canBuy}
        style={[styles.primaryBtn, !canBuy && styles.btnDisabled]}
        onPress={onAdd}
      >
        <Ionicons name="cart-outline" size={18} color="#fff" />
        <Text style={[styles.primaryBtnText, !canBuy && styles.btnDisabledText]}>{addLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!canBuy}
        style={[styles.outlineBtn, !canBuy && styles.btnDisabled]}
        onPress={onBuyNow}
      >
        <Text style={[styles.outlineBtnText, !canBuy && styles.btnDisabledText]}>{buyLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SpecsCard({ specs, open, onToggle }) {
  return (
    <View style={styles.accWrap}>
      <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={styles.accHeader}>
        <Text style={styles.accTitle}>Điểm nổi bật</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#9AA4B2" />
      </TouchableOpacity>

      {open ? (
        <View style={styles.accBody}>
          {(Array.isArray(specs) ? specs : []).map((s, idx) => (
            <View key={`${s.label}-${idx}`} style={styles.specRow}>
              <Text style={styles.specLabel}>{s.label}</Text>
              <Text style={styles.specValue}>{s.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RelatedList({ navigation, related }) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>Sản phẩm tương tự</Text>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={related}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ gap: 12, paddingTop: 10 }}
        renderItem={({ item }) => (
          <View style={{ width: 150 }}>
            <ProductCard
              item={item}
              onPress={() => navigation.navigate("ProductDetail", { item, id: item.apiId || item._id || item.id })}
            />
          </View>
        )}
      />
    </Card>
  );
}

function CompatibleList({ navigation, items, title }) {
  if (!items || items.length === 0) return null;

  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(it) => String(it.apiId || it._id || it.id)}
        contentContainerStyle={{ gap: 12, paddingTop: 10 }}
        renderItem={({ item }) => (
          <View style={{ width: 150 }}>
            <ProductCard
              item={item}
              onPress={() =>
                navigation.navigate("ProductDetail", {
                  item,
                  id: item.apiId || item._id || item.id,
                })
              }
            />
          </View>
        )}
      />
    </Card>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Segmented({ items, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <TouchableOpacity
            key={it.key}
            activeOpacity={0.85}
            onPress={() => onChange(it.key)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Accordion({ title, open, onToggle, content }) {
  return (
    <View style={styles.accWrap}>
      <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={styles.accHeader}>
        <Text style={styles.accTitle}>{title}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#9AA4B2" />
      </TouchableOpacity>
      {open ? <View style={styles.accBody}>{content}</View> : null}
    </View>
  );
}

function RxInput({ label, placeholder, value, onChangeText }) {
  return (
    <View style={styles.rxCell}>
      <Text style={styles.rxLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA4B2"
        keyboardType="numeric"
        style={styles.rxInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },
  content: { paddingHorizontal: 16, paddingBottom: 16 },

  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  headerRight: { flexDirection: "row", gap: 10 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15.5, fontWeight: "900", color: "#111827", flexShrink: 1 },

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

  heroCard: { padding: 10 },
  heroImageWrap: {
    height: 210,
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: { width: "100%", height: "100%" },

  discountBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    zIndex: 3,
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  discountBadgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  statusPill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    zIndex: 3,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: "800", color: "#111827" },

  outOfStockOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  outOfStockText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  heroImageDisabled: { opacity: 0.6 },

  favBtnOnImage: {
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  modeSwitchWrap: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 10,
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    padding: 4,
    elevation: 3,
  },

  modeSwitchItem: {
    minWidth: 46,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modeSwitchItemActive: { backgroundColor: "#111827" },
  modeSwitchText: { fontSize: 12, fontWeight: "900", color: "#111827" },
  modeSwitchTextActive: { color: "#fff" },

  name: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  mutedText: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  tryOnHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tryOnTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  tryOnStatusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tryOnStatusPillReady: { backgroundColor: "#E7F8EF" },
  tryOnStatusPillPending: { backgroundColor: "#FFECEC" },
  tryOnStatusText: { fontSize: 11, fontWeight: "900" },
  tryOnStatusTextReady: { color: "#159947" },
  tryOnStatusTextPending: { color: "#D33A2C" },
  tryOnHint: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  tryOnButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  tryOnButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  metaRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  ratingText: { fontSize: 12, fontWeight: "900", color: "#111827" },
  metaText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  dot: { color: "#9AA4B2", fontWeight: "900" },

  stockBadge: { backgroundColor: "#E7F8EF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  stockBadgeText: { color: "#159947", fontWeight: "900", fontSize: 12 },

  outOfStockBadge: { backgroundColor: "#FFECEC", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  outOfStockBadgeText: { color: "#EF4444", fontWeight: "900", fontSize: 12 },

  stockInfo: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#159947" },

  priceRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  price: { fontSize: 18, fontWeight: "900", color: "green" },
  priceDisabled: { color: "#9CA3AF" },
  originalPrice: { fontSize: 12, fontWeight: "800", color: "#9CA3AF", textDecorationLine: "line-through" },
  offBadge: { backgroundColor: "#FFECEC", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  offBadgeText: { color: "#D33A2C", fontWeight: "900", fontSize: 12 },

  segmented: { marginTop: 10, flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 14, padding: 4, gap: 6 },
  segmentItem: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: "#FFFFFF" },
  segmentText: { fontSize: 12, fontWeight: "900", color: "#6B7280" },
  segmentTextActive: { color: "#111827" },

  eyeLabel: { marginTop: 10, fontSize: 12, fontWeight: "900", color: "#111827" },
  rxRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  rxCell: { flex: 1 },
  rxLabel: { fontSize: 12, fontWeight: "900", color: "#6B7280", marginBottom: 6 },
  rxInput: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },

  colorRow: { marginTop: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  colorDotWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotWrapActive: { borderColor: "#111827", borderWidth: 2 },
  colorDot: { width: 18, height: 18, borderRadius: 9 },

  sizeRow: { marginTop: 10, flexDirection: "row", gap: 10 },
  sizePill: { width: 46, height: 38, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  sizePillActive: { backgroundColor: "#111827" },
  sizeText: { fontWeight: "900", color: "#111827" },
  sizeTextActive: { color: "#fff" },

  outOfStockInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFECEC",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  outOfStockInfoText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#D33A2C" },

  qtyRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 14 },
  qtyBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 18, fontWeight: "900", color: "#111827" },
  qtyValue: { width: 30, textAlign: "center", fontSize: 14, fontWeight: "900", color: "#111827" },

  ctaRow: { marginTop: 14, flexDirection: "row", gap: 12 },
  primaryBtn: { flex: 1, height: 46, borderRadius: 14, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "900" },
  outlineBtn: { width: 130, height: 46, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  outlineBtnText: { color: "#2563EB", fontWeight: "900" },
  btnDisabled: { opacity: 0.45 },
  btnDisabledText: { color: "#9CA3AF" },

  noteInput: {
    marginTop: 10,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },

  specRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEF2F7" },
  specLabel: { width: 130, fontSize: 12, fontWeight: "800", color: "#6B7280" },
  specValue: { flex: 1, fontSize: 12, fontWeight: "900", color: "#111827" },

  accWrap: { marginTop: 12, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4, elevation: 3 },
  accHeader: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  accBody: { paddingBottom: 14 },
  accText: { fontSize: 13, fontWeight: "700", color: "#4B5563", lineHeight: 18 },

  expand3DBtn: {
    position: "absolute",
    left: 10,
    top: 10,
    zIndex: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  expand3DBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },

  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
  },

  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  previewContentWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 24,
    zIndex: 2,
  },

  previewCard: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  previewImage: {
    width: "100%",
    height: "100%",
  },

  previewCloseBtn: {
    position: "absolute",
    top: 50,
    right: 18,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  heroModelViewer: {
    width: "100%",
    height: "100%",
  },
  previewModelViewer: {
    width: "100%",
    height: "100%",
  },
});
