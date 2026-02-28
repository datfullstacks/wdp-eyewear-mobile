// screens/ProductDetailScreen.js
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";

import { useFavoriteStore } from "../store/favoriteStore";
import { useProducts } from "../hooks/useProducts";
import { getRelatedProducts, fetchProductById } from "../services/productService";
import { useCartStore } from "../store/cartStore";
import CartIconButton from "../components/CartIconButton";
import ProductCard from "../components/ProductCard";
import { useAuthStore } from "../store/authStore";

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

function normalizeStr(s) {
  return String(s ?? "").trim().toLowerCase();
}

// chọn variant theo options color/size (match mềm)
function getSelectedVariant(product, { colorId, size }) {
  if (!product?.variants?.length) return null;

  const colorObj = product.colors?.find((c) => c.id === colorId);
  const colorKey =
    colorObj?.name || colorObj?.label || colorObj?.id || null;

  return (
    product.variants.find((v) => {
      const opts = v?.options || {};
      const hasColor = Object.prototype.hasOwnProperty.call(opts, "color");
      const hasSize = Object.prototype.hasOwnProperty.call(opts, "size");

      const vColor = opts.color ?? null;
      const vSize = opts.size ?? null;

      const okColor = colorKey
        ? normalizeStr(vColor) === normalizeStr(colorKey)
        : true;

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

/* -------------------- Screen -------------------- */

export default function ProductDetailScreen({ navigation, route }) {
  const token = useAuthStore((s) => s.token);
  const passedItem = route?.params?.item;
  const passedId = route?.params?.id || route?.params?.productId;

  const { products } = useProducts();
  const [specsOpen, setSpecsOpen] = useState(true);

  const requireLogin = () => {
    Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập để sử dụng tính năng này.", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng nhập", onPress: () => navigation.navigate("Login") },
    ]);
  };

  // ✅ fallback product lấy từ list nếu chỉ có passedId
  const fallbackFromList = useMemo(() => {
    if (!passedId) return null;
    return products.find((p) => p.id === passedId) || null;
  }, [passedId, products]);

  // ✅ product state: render nhanh bằng passedItem/fallback, rồi refresh bằng API by id
  const [product, setProduct] = useState(passedItem ?? fallbackFromList ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ apiId ưu tiên Mongo _id/apiId
  const apiId = useMemo(() => {
    return passedItem?.apiId || passedItem?._id || passedId || null;
  }, [passedItem, passedId]);

  // ✅ fetch fresh by id
  useEffect(() => {
    let mounted = true;
    if (!apiId) return;

    (async () => {
      try {
        setIsRefreshing(true);
        const fresh = await fetchProductById(apiId);
        if (mounted && fresh) setProduct(fresh);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setIsRefreshing(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiId]);

  // hydrate cart once
  useEffect(() => {
    const st = useCartStore.getState();
    if (st && st.isHydrating) st.hydrate();
  }, []);

  const addItem = useCartStore((s) => s.addItem);

  const toggleFav = useFavoriteStore((s) => s.toggle);
  const fav = useFavoriteStore((s) => s.ids.includes(product?.id));

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

  // UI state
  const [orderType, setOrderType] = useState("READY");

  const [colorId, setColorId] = useState(
    product?.type === "FRAME" ? product?.colors?.[0]?.id : null
  );

  const [size, setSize] = useState(
    product?.type === "FRAME"
      ? product?.sizes?.[0]
      : product?.variants?.[0]?.options?.size || "STD"
  );

  const [qty, setQty] = useState(1);

  // READY data for all types (note)
  const [readyNote, setReadyNote] = useState("");

  useEffect(() => {
    if (!product) return;

    // reset when product changes
    setQty(1);
    setReadyNote("");

    if (product.type === "FRAME") {
      setColorId(product.colors?.[0]?.id || null);
      setSize(product.sizes?.[0] || "M");
    } else {
      setColorId(null);
      // size fallback from variant
      const vSize = product.variants?.[0]?.options?.size;
      setSize(vSize || "STD");
    }
  }, [product]);

  // LENS Rx
  const [rxOD, setRxOD] = useState({ CYL: "", AXIS: "" });
  const [rxOS, setRxOS] = useState({ CYL: "", AXIS: "" });

  // Rx photo for CUSTOM/PREORDER (LENS)
  const [rxPhoto, setRxPhoto] = useState(null);

  // accordion state
  const [open, setOpen] = useState({
    desc: false,
    sizeGuide: false,
    reviews: false,
    qa: false,
  });

  const mainImage = useMemo(() => {
    if (!product) return null;
    if (product.type !== "FRAME") return product.image;
    const c = product.colors?.find((x) => x.id === colorId);
    return c?.imageOverride || product.image;
  }, [product, colorId]);

  const related = useMemo(() => {
    if (!product) return [];
    return getRelatedProducts(products, product);
  }, [product, products]);

  const minQty = product?.qtyLimits?.min ?? 1;
  const maxQty = product?.qtyLimits?.max ?? 99;

  const incQty = () => setQty((q) => Math.min(maxQty, q + 1));
  const decQty = () => setQty((q) => Math.max(minQty, q - 1));

  const onToggleAccordion = (key) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  // ✅ selected variant + stock
  const selectedVariant = useMemo(() => {
    if (!product) return null;
    if (product.type === "FRAME") return getSelectedVariant(product, { colorId, size });
    return getSelectedVariant(product, { colorId: null, size });
  }, [product, colorId, size]);

  const variantStock = selectedVariant?.stock ?? product?.totalStock ?? 0;
  const isVariantOut = variantStock <= 0;

  const showPreorder = isVariantOut;

  const orderTypeItems = useMemo(() => ([
    { key: "READY", label: ORDER_TYPES.READY },
    { key: "CUSTOM", label: ORDER_TYPES.CUSTOM },
  ]), []);

  const canBuy = useMemo(() => {
    if (!product) return false;

    return true;
  }, [product]);

  useEffect(() => {
    if (!product) return;
    // không set PREORDER nữa
    if (!orderType || (orderType !== "READY" && orderType !== "CUSTOM")) {
      setOrderType("READY");
    }
  }, [product?.id]);

  // ✅ pick rx photo
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

  const hasFrameInCart = () => {
    const st = useCartStore.getState();
    return (st.items || []).some((x) => x.product?.type === "FRAME");
  };

  const doAddToCart = useCallback(() => {
    if (!product) return;

    if (product.type === "LENS") {
      const hasRx = isRxFilled(rxOD, rxOS);
      const hasPhoto = Boolean(rxPhoto?.uri);

      if (orderType === "READY" && !hasRx) {
        Alert.alert("Thiếu thông số", "Vui lòng nhập đầy đủ thông số (OD/OS).");
        return;
      }
      if (orderType === "CUSTOM" && !hasPhoto) {
        Alert.alert("Thiếu ảnh đơn kính", "Vui lòng tải ảnh đơn kính để tiếp tục.");
        return;
      }

      addItem({
        product,
        orderType,   
        isPreorder: isVariantOut, 
        qty,
        rxOD: orderType === "READY" ? rxOD : null,
        rxOS: orderType === "READY" ? rxOS : null,
        rxPhoto: orderType === "CUSTOM" ? rxPhoto : null,
      });

      Toast.show({
        type: "success",
        text1: isVariantOut ? "Đã đặt trước" : "Đã thêm vào giỏ",
        text2: product.name,
      });
      return;
    }

    // FRAME / other types
    const c = product.colors?.find((x) => x.id === colorId);

    addItem({
      product,
      orderType,
      isPreorder: isVariantOut,   // ✅ NEW
      qty,
      variantId: selectedVariant?._id || null,
      variant: product.type === "FRAME"
        ? { colorId, colorName: c?.name || c?.label || "—", size }
        : { size },
      variantText: product.type === "FRAME" ? `${c?.name || "—"} • ${size}` : size ? `Size ${size}` : null,
      readyNote: orderType === "READY" ? readyNote : null,
    });

    Toast.show({
      type: "success",
      text1: isVariantOut ? "Đã đặt trước" : "Đã thêm vào giỏ",
      text2: product.name,
    });
  }, [product, orderType, qty, addItem, colorId, size, readyNote, selectedVariant, rxOD, rxOS, rxPhoto]);

  const onAddToCart = useCallback(() => {
    if (!token) return requireLogin();
    if (!product || !canBuy) return;

    // soft warning: lens without frame is allowed
    if (product.type === "LENS" && !hasFrameInCart()) {
      Alert.alert(
        "Bạn đang mua tròng riêng",
        "Nếu bạn chưa có gọng phù hợp, bạn có thể thêm gọng để shop hỗ trợ lắp và căn chỉnh tốt hơn.",
        [
          { text: "Thêm vào giỏ (tròng)", onPress: doAddToCart },
          { text: "Chọn thêm gọng", onPress: () => navigation.navigate("Tabs", { screen: "ProductsTab" }) },
          { text: "Hủy", style: "cancel" },
        ]
      );
      return;
    }

    doAddToCart();
  }, [token, product, canBuy, doAddToCart, navigation]);

  const onBuyNow = () => {
    if (!token) return requireLogin();
    onAddToCart();
    navigation.navigate("Tabs", { screen: "CartTab" });
  };

  const onToggleFav = () => {
    if (!token) return requireLogin();
    if (!product) return;
    const wasFav = fav;
    toggleFav(product);
    Toast.show({
      type: "success",
      text1: wasFav ? "Đã bỏ yêu thích" : "Đã thêm yêu thích",
      text2: product.name,
    });
  };

  if (!product) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <HeaderBar navigation={navigation} title="Chi tiết sản phẩm" />
        <View style={{ padding: 16 }}>
          <Text>Không tìm thấy sản phẩm.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ACCORDIONS = [
    { key: "desc", title: "Mô tả sản phẩm", content: product.sections?.description || "—" },
    { key: "sizeGuide", title: "Hướng dẫn chọn size", content: product.sections?.sizeGuide || "—" },
    { key: "reviews", title: `Đánh giá (${product.ratingCount ?? product.ratingsQuantity ?? 0})`, content: "Preview reviews…" },
    { key: "qa", title: `Hỏi đáp (${product.qaCount ?? 0})`, content: "Preview Q&A…" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HeaderBar navigation={navigation} title={headerTitle} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
        />

        <InfoCard product={product} discountPct={discountPct} isVariantOut={isVariantOut} variantStock={variantStock} />

        <Card>
          <Text style={styles.sectionTitle}>Loại đơn hàng</Text>

          <Segmented items={orderTypeItems} value={orderType} onChange={setOrderType} />

          <Text style={styles.mutedText}>
            {showPreorder
              ? "Biến thể bạn chọn hiện hết hàng — bạn có thể đặt trước."
              : product.shipping?.etaLabel || "Giao nhanh 1–3 ngày"}
          </Text>
        </Card>

        {product.type === "LENS" ? (
          <LensOptions
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
            isPreorder={isVariantOut}
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

        <RelatedList navigation={navigation} related={related} />

        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- Components -------------------- */

function HeaderBar({ navigation, title }) {
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

        <CartIconButton onPress={() => navigation.navigate("CartFlow", { screen: "Cart" })} />
      </View>
    </View>
  );
}

function Hero({ product, image, discountPct, fav, onToggleFav, isVariantOut }) {
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

        <TouchableOpacity activeOpacity={0.85} onPress={onToggleFav} style={styles.favBtnOnImage}>
          <Ionicons name={fav ? "heart" : "heart-outline"} size={20} color="#EF4444" />
        </TouchableOpacity>

        {image ? (
          <Image
            source={{ uri: image }}
            style={[styles.heroImage, isOutOfStock && styles.heroImageDisabled]}
            resizeMode="contain"
          />
        ) : null}

        {product.type === "FRAME" && product.model3D?.enabled && !isOutOfStock ? (
          <View style={styles.modeSwitchWrap}>
            <TouchableOpacity activeOpacity={0.9} style={[styles.modeSwitchItem, styles.modeSwitchItemActive]}>
              <Text style={[styles.modeSwitchText, styles.modeSwitchTextActive]}>2D</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.9} style={styles.modeSwitchItem}>
              <Text style={styles.modeSwitchText}>3D</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Card>
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

  const ratingCount =
    product.ratingCount ?? product.ratingsQuantity ?? 0;

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

      {!isOutOfStock && variantStock > 0 ? (
        <Text style={styles.stockInfo}>Còn {variantStock} sản phẩm</Text>
      ) : null}
    </Card>
  );
}

function LensOptions({
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
  isPreorder,
  qty,
  incQty,
  decQty,
}) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>Thông số</Text>

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
            {isPreorder
              ? "Sản phẩm hết hàng. Bạn đang đặt trước — vui lòng cung cấp thông tin theo lựa chọn dưới đây."
              : orderType === "CUSTOM"
                ? "Làm theo đơn: Vui lòng tải ảnh đơn kính do bác sĩ cung cấp."
                : ""}
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.outlineBtn, { width: "100%", marginTop: 10 }]}
            onPress={pickRxPhoto}
          >
            <Text style={styles.outlineBtnText}>
              {rxPhoto?.uri ? "Đổi ảnh đơn kính" : "Tải ảnh đơn kính"}
            </Text>
          </TouchableOpacity>

          {rxPhoto?.uri ? <Text style={styles.mutedText}>Đã chọn ảnh</Text> : null}
        </View>
      )}

      {/* ✅ Số lượng (kể cả khi đặt trước) */}
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

      <CTAButtons
        canBuy={canBuy}
        onAdd={onAdd}
        onBuyNow={onBuyNow}
        isPreorder={isPreorder}
      />
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
}) {
  const hasColors = Array.isArray(product?.colors) && product.colors.length > 0;
  const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;
  const isOutOfStock = isVariantOut;

  return (
    <Card>
      {isOutOfStock && (
        <View style={styles.outOfStockInfoBox}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.outOfStockInfoText}>
            Sản phẩm bạn chọn hiện đang hết hàng — bạn vẫn có thể nhập số lượng và bấm “Đặt trước”.
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

      {/* READY note for all non-lens */}
      {orderType === "READY" ? (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.sectionTitle}>Thông số/Ghi chú</Text>
          <TextInput
            value={readyNote}
            onChangeText={setReadyNote}
            placeholder="Nhập ghi chú hoặc thông số bạn muốn cung cấp…"
            placeholderTextColor="#9AA4B2"
            style={styles.noteInput}
            multiline
          />
        </View>
      ) : null}

      <CTAButtons
        canBuy={canBuy}
        onAdd={onAdd}
        onBuyNow={onBuyNow}
        isPreorder={isOutOfStock}   // ✅ gọng hết hàng => nút thành Đặt trước
      />
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
          {(specs || []).map((s, idx) => (
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

/* -------------------- Small UI -------------------- */

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

/* -------------------- Styles -------------------- */
/* ✅ giữ nguyên styles của bạn + thêm noteInput */
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

  heroImageDisabled: {
    opacity: 0.6,
  },

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
  modeSwitchItem: { minWidth: 46, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  modeSwitchItemActive: { backgroundColor: "#111827" },
  modeSwitchText: { fontSize: 12, fontWeight: "900", color: "#111827" },
  modeSwitchTextActive: { color: "#fff" },

  name: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  mutedText: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#6B7280" },

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
  rxInput: { height: 44, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, fontSize: 13, fontWeight: "900", color: "#111827", backgroundColor: "#FFFFFF" },

  colorRow: { marginTop: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  colorDotWrap: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
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
});