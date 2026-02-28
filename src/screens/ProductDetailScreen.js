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

const TRY_ON_STATUS_LABEL = {
  draft: "Try-on is not published yet",
  pending_review: "Try-on is under review",
  approved: "Try-on approved, waiting publish",
  published: "Try-on available",
  rejected: "Try-on needs update",
  archived: "Try-on is archived",
};

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
  const [isRefreshing, setIsRefreshing] = useState(false); // optional

  // ✅ apiId để gọi /api/products/:id
  // ưu tiên apiId/_id (Mongo) nếu có, sau đó mới fallback passedId
  const apiId = useMemo(() => {
    return passedItem?.apiId || passedItem?._id || passedId || null;
  }, [passedItem, passedId]);

  // ✅ GỌI API by id để lấy dữ liệu đầy đủ/chuẩn nhất
  useEffect(() => {
    let mounted = true;
    if (!apiId) return;

    (async () => {
      try {
        setIsRefreshing(true);
        const fresh = await fetchProductById(apiId);
        if (mounted && fresh) setProduct(fresh);
      } catch (e) {
        // fail => giữ product hiện tại (passedItem/fallback)
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

  const [orderType, setOrderType] = useState(
    product?.defaultOrderType || product?.orderTypes?.[0] || "READY"
  );

  const [colorId, setColorId] = useState(product?.type === "FRAME" ? product?.colors?.[0]?.id : null);
  const [size, setSize] = useState(product?.type === "FRAME" ? product?.sizes?.[0] : "M");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;

    setOrderType(product.defaultOrderType || product.orderTypes?.[0] || "READY");

    if (product.type === "FRAME") {
      setColorId(product.colors?.[0]?.id || null);
      setSize(product.sizes?.[0] || "M");
    } else {
      setColorId(null);
      setSize("M");
    }

    setQty(1);
  }, [product]);

  // LENS Rx
  const [rxOD, setRxOD] = useState({ CYL: "", AXIS: "" });
  const [rxOS, setRxOS] = useState({ CYL: "", AXIS: "" });

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

  const canBuy = product?.stockStatus !== "OUT_OF_STOCK";
  const minQty = product?.qtyLimits?.min ?? 1;
  const maxQty = product?.qtyLimits?.max ?? 99;

  const incQty = () => setQty((q) => Math.min(maxQty, q + 1));
  const decQty = () => setQty((q) => Math.max(minQty, q - 1));

  const onToggleAccordion = (key) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const onAddToCart = useCallback(() => {
    if (!token) return requireLogin();
    if (!product || !canBuy) return;

    if (product.type === "LENS") {
      addItem({ product, orderType, qty: 1, rxOD, rxOS });
    } else {
      const c = product.colors?.find((x) => x.id === colorId);
      addItem({
        product,
        orderType,
        qty,
        variant: {
          colorId,
          colorName: c?.name || c?.label || "—",
          size,
        },
      });
    }

    Toast.show({ type: "success", text1: "Đã thêm vào giỏ", text2: product.name });
  }, [token, product, canBuy, addItem, orderType, rxOD, rxOS, colorId, qty, size]);

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

  const onOpenTryOn = useCallback(() => {
    const tryOn = product?.tryOn;
    if (!tryOn?.ready) {
      Alert.alert("Try-on", "Try-on is not ready for this product.");
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
  }, [navigation, product]);

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
    { key: "reviews", title: `Đánh giá (${product.ratingCount ?? 0})`, content: "Preview reviews…" },
    { key: "qa", title: `Hỏi đáp (${product.qaCount ?? 0})`, content: "Preview Q&A…" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HeaderBar navigation={navigation} title={headerTitle} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* optional: hiển thị trạng thái đang refresh */}
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
        />

        <InfoCard product={product} discountPct={discountPct} />

        {product.type === "FRAME" && product?.tryOn?.enabled ? (
          <TryOnCard tryOn={product.tryOn} onOpenTryOn={onOpenTryOn} />
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Loại đơn hàng</Text>
          <Segmented
            items={(product.orderTypes || ["READY"]).map((k) => ({ key: k, label: ORDER_TYPES[k] || k }))}
            value={orderType}
            onChange={setOrderType}
          />
          <Text style={styles.mutedText}>{product.shipping?.etaLabel || "Giao nhanh 1–3 ngày"}</Text>
        </Card>

        {product.type === "LENS" ? (
          <LensOptions
            rxOD={rxOD}
            rxOS={rxOS}
            setRxOD={setRxOD}
            setRxOS={setRxOS}
            canBuy={canBuy}
            onAdd={onAddToCart}
            onBuyNow={onBuyNow}
          />
        ) : (
          <FrameOptions
            product={product}
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
          />
        )}

        <SpecsCard
          specs={product.specs || []}
          open={specsOpen}
          onToggle={() => setSpecsOpen((p) => !p)}
        />

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

function Hero({ product, image, discountPct, fav, onToggleFav }) {
  const isOutOfStock = product?.stockStatus === "OUT_OF_STOCK";

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

function InfoCard({ product, discountPct }) {
  const isOutOfStock = product?.stockStatus === "OUT_OF_STOCK";

  return (
    <Card>
      <Text style={styles.name}>{product.name}</Text>

      <View style={styles.metaRow}>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.ratingText}>
            {typeof product.ratingAvg === "number" ? product.ratingAvg.toFixed(1) : "4.7"}
          </Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.metaText}>{product.ratingCount ?? 0} đánh giá</Text>
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
        <Text style={[styles.price, isOutOfStock && styles.priceDisabled]}>{formatVND(product.price)}</Text>
        {product.originalPrice ? <Text style={styles.originalPrice}>{formatVND(product.originalPrice)}</Text> : null}
        {discountPct > 0 && !isOutOfStock ? (
          <View style={styles.offBadge}>
            <Text style={styles.offBadgeText}>-{discountPct}%</Text>
          </View>
        ) : null}
      </View>

      {product.totalStock > 0 && !isOutOfStock && (
        <Text style={styles.stockInfo}>Còn {product.totalStock} sản phẩm</Text>
      )}
    </Card>
  );
}

function TryOnCard({ tryOn, onOpenTryOn }) {
  const status = String(tryOn?.status || "").trim().toLowerCase();
  const statusLabel = TRY_ON_STATUS_LABEL[status] || "Try-on status unavailable";
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
            {canOpen ? "Ready" : "Unavailable"}
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
        <Ionicons name="camera-outline" size={18} color="#fff" />
        <Text style={[styles.tryOnButtonText, !canOpen && styles.btnDisabledText]}>
          {canOpen ? "Open Try-On" : "Try-On Not Available"}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

function LensOptions({ rxOD, rxOS, setRxOD, setRxOS, canBuy, onAdd, onBuyNow }) {
  return (
    <Card>
      <Text style={styles.sectionTitle}>Thông số</Text>

      <Text style={styles.eyeLabel}>Mắt phải (OD)</Text>
      <View style={styles.rxRow}>
        <RxInput label="CYL" placeholder="0.00" value={rxOD.CYL} onChangeText={(t) => setRxOD((p) => ({ ...p, CYL: t }))} />
        <RxInput label="AXIS" placeholder="0" value={rxOD.AXIS} onChangeText={(t) => setRxOD((p) => ({ ...p, AXIS: t }))} />
      </View>

      <Text style={[styles.eyeLabel, { marginTop: 10 }]}>Mắt trái (OS)</Text>
      <View style={styles.rxRow}>
        <RxInput label="CYL" placeholder="0.00" value={rxOS.CYL} onChangeText={(t) => setRxOS((p) => ({ ...p, CYL: t }))} />
        <RxInput label="AXIS" placeholder="0" value={rxOS.AXIS} onChangeText={(t) => setRxOS((p) => ({ ...p, AXIS: t }))} />
      </View>

      <CTAButtons canBuy={canBuy} onAdd={onAdd} onBuyNow={onBuyNow} />
    </Card>
  );
}

function FrameOptions({ product, colorId, setColorId, size, setSize, qty, incQty, decQty, canBuy, onAdd, onBuyNow }) {
  const hasColors = Array.isArray(product?.colors) && product.colors.length > 0;
  const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;
  const isOutOfStock = product?.stockStatus === "OUT_OF_STOCK";

  return (
    <Card>
      {isOutOfStock && (
        <View style={styles.outOfStockInfoBox}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.outOfStockInfoText}>Sản phẩm này hiện đang hết hàng</Text>
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
                  onPress={() => !isOutOfStock && setColorId(c.id)}
                  disabled={isOutOfStock}
                  style={[styles.colorDotWrap, active && styles.colorDotWrapActive, isOutOfStock && styles.colorDotWrapDisabled]}
                >
                  <View style={[styles.colorDot, { backgroundColor: c.hex, opacity: isOutOfStock ? 0.5 : 1 }]} />
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
                  onPress={() => !isOutOfStock && setSize(s)}
                  disabled={isOutOfStock}
                  style={[styles.sizePill, active && styles.sizePillActive, isOutOfStock && styles.sizePillDisabled]}
                >
                  <Text style={[styles.sizeText, active && styles.sizeTextActive, isOutOfStock && styles.sizeTextDisabled]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {!isOutOfStock && (
        <>
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
        </>
      )}

      <CTAButtons canBuy={canBuy} onAdd={onAdd} onBuyNow={onBuyNow} />
    </Card>
  );
}

function CTAButtons({ canBuy, onAdd, onBuyNow }) {
  return (
    <View style={styles.ctaRow}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!canBuy}
        style={[styles.primaryBtn, !canBuy && styles.btnDisabled]}
        onPress={onAdd}
      >
        <Ionicons name="cart-outline" size={18} color="#fff" />
        <Text style={[styles.primaryBtnText, !canBuy && styles.btnDisabledText]}>Thêm vào giỏ</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!canBuy}
        style={[styles.outlineBtn, !canBuy && styles.btnDisabled]}
        onPress={onBuyNow}
      >
        <Text style={[styles.outlineBtnText, !canBuy && styles.btnDisabledText]}>Mua ngay</Text>
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
              onPress={() => navigation.navigate("ProductDetail", { item, id: item.apiId })}
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
/* ✅ giữ nguyên styles của bạn */
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
  tryOnHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tryOnTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  tryOnStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
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
  tryOnButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },

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
  colorDotWrapDisabled: { opacity: 0.5 },
  colorDot: { width: 18, height: 18, borderRadius: 9 },

  sizeRow: { marginTop: 10, flexDirection: "row", gap: 10 },
  sizePill: { width: 46, height: 38, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  sizePillActive: { backgroundColor: "#111827" },
  sizePillDisabled: { opacity: 0.5 },
  sizeText: { fontWeight: "900", color: "#111827" },
  sizeTextActive: { color: "#fff" },
  sizeTextDisabled: { color: "#9CA3AF" },

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

  specRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEF2F7" },
  specLabel: { width: 130, fontSize: 12, fontWeight: "800", color: "#6B7280" },
  specValue: { flex: 1, fontSize: 12, fontWeight: "900", color: "#111827" },

  accWrap: { marginTop: 12, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4, elevation: 3 },
  accHeader: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  accBody: { paddingBottom: 14 },
  accText: { fontSize: 13, fontWeight: "700", color: "#4B5563", lineHeight: 18 },
});
