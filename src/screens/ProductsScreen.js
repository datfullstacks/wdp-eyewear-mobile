import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import HeaderSearchActions from "../components/HeaderSearchActions";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";
import { useStores } from "../hooks/useStores";
import { getMyFavoriteIdsApi } from "../services/userService";
import { useAuthStore } from "../store/authStore";
import { useStoreNetworkStore } from "../store/storeNetworkStore";

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

const { width } = Dimensions.get("window");
const PAGE_PADDING = 16;
const GAP = 12;
const CARD_W = (width - PAGE_PADDING * 2 - GAP) / 2;

const SORT_OPTIONS = [
  { key: "default", label: "Mặc định", icon: "sparkles-outline" },
  { key: "best", label: "Bán chạy", icon: "trending-up-outline" },
  { key: "name_asc", label: "Tên A-Z", icon: "text-outline" },
  { key: "name_desc", label: "Tên Z-A", icon: "text-outline" },
  { key: "price_asc", label: "Giá tăng dần", icon: "arrow-up-outline" },
  { key: "price_desc", label: "Giá giảm dần", icon: "arrow-down-outline" },
  { key: "discount_desc", label: "Giảm giá nhiều", icon: "pricetag-outline" },
  { key: "rating_desc", label: "Đánh giá cao", icon: "star-outline" },
];

const PRICE_RANGES = [
  { key: "all", label: "Tất cả", min: null, max: null },
  { key: "0_500", label: "Dưới 500k", min: 0, max: 500_000 },
  { key: "500_2m", label: "500k - 2tr", min: 500_000, max: 2_000_000 },
  { key: "2m_plus", label: "Trên 2tr", min: 2_000_000, max: null },
];

function Chip({ label, onRemove }) {
  return (
    <View style={styles.appliedChip}>
      <Text style={styles.appliedChipText} numberOfLines={1}>
        {label}
      </Text>
      {!!onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.chipX} hitSlop={10}>
          <View style={{borderWidth: 1, borderColor: "#ffc0c0", borderRadius: 50, padding: 2, backgroundColor: "#ffe5e5"}}>
            <Ionicons name="close" size={14} color="red" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

function BottomSheet({ visible, title, onClose, children }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onPress={() => { }}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={PALETTE.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.sheetBody}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("vi-VN");
}

export default function ProductsScreen({ navigation }) {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const [query, setQuery] = useState("");
  const selectedStoreId = useStoreNetworkStore((s) => s.selectedStoreId);
  const hydrateStoreSelection = useStoreNetworkStore((s) => s.hydrate);
  const setSelectedStoreId = useStoreNetworkStore((s) => s.setSelectedStoreId);
  const ensureDefaultStore = useStoreNetworkStore((s) => s.ensureDefaultStore);
  const { stores } = useStores();
  const { products, isLoading, isError } = useProducts({
    storeId: selectedStoreId || undefined,
  });
  const [favoriteIds, setFavoriteIds] = useState([]);

  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyPreorder, setOnlyPreorder] = useState(false);
  const [typeFrame, setTypeFrame] = useState(false);
  const [typeLens, setTypeLens] = useState(false);
  const [typeSunglasses, setTypeSunglasses] = useState(false);
  const [typeContactLens, setTypeContactLens] = useState(false);
  const [typeAccessory, setTypeAccessory] = useState(false);
  const [priceKey, setPriceKey] = useState("all");
  const [brandFilter, setBrandFilter] = useState(null);
  const [colorFilters, setColorFilters] = useState([]);
  const [sizeFilters, setSizeFilters] = useState([]);
  const [sortKey, setSortKey] = useState("default");

  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);

  useEffect(() => {
    void hydrateStoreSelection();
  }, [hydrateStoreSelection]);

  useEffect(() => {
    if (!stores.length) return;
    void ensureDefaultStore(stores);
  }, [ensureDefaultStore, stores]);

  useEffect(() => {
    const params = route?.params || {};

    if (Object.prototype.hasOwnProperty.call(params, "q")) {
      setQuery(String(params.q || ""));
    }

    if (params.autoApplyFilter) {
      setTypeFrame(false);
      setTypeLens(false);
      setTypeSunglasses(false);
      setTypeContactLens(false);
      setTypeAccessory(false);

      switch (params.filterType) {
        case "frame":
          setTypeFrame(true);
          break;
        case "lens":
          setTypeLens(true);
          break;
        case "sunglasses":
          setTypeSunglasses(true);
          break;
        case "contact_lens":
          setTypeContactLens(true);
          break;
        case "accessory":
          setTypeAccessory(true);
          break;
        default:
          break;
      }
    }
  }, [route?.params]);

  const loadFavorites = useCallback(async () => {
    if (!token) {
      setFavoriteIds([]);
      return;
    }

    try {
      const ids = await getMyFavoriteIdsApi();
      setFavoriteIds(Array.isArray(ids) ? ids.map(String) : []);
    } catch {
      setFavoriteIds([]);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const handleFavoriteChanged = useCallback((nextFav, changedItem) => {
    const changedId = String(changedItem?.id);
    setFavoriteIds((prev) =>
      nextFav
        ? Array.from(new Set([changedId, ...prev]))
        : prev.filter((id) => id !== changedId)
    );
  }, []);

  const appliedChips = useMemo(() => {
    const out = [];

    if (typeFrame) out.push({ key: "type_frame", label: "Gọng kính" });
    if (typeLens) out.push({ key: "type_lens", label: "Tròng kính" });
    if (typeSunglasses) out.push({ key: "type_sunglasses", label: "Kính mát" });
    if (typeContactLens) out.push({ key: "type_contact_lens", label: "Kính áp tròng" });
    if (typeAccessory) out.push({ key: "type_accessory", label: "Phụ kiện" });

    if (onlyInStock) out.push({ key: "in_stock", label: "Có sẵn" });
    if (onlyPreorder) out.push({ key: "preorder", label: "Đặt trước" });

    const pr = PRICE_RANGES.find((x) => x.key === priceKey);
    if (pr && pr.key !== "all") {
      out.push({ key: `price_${pr.key}`, label: pr.label });
    }

    if (brandFilter) {
      out.push({ key: `brand_${brandFilter}`, label: `Thương hiệu: ${brandFilter}` });
    }

    if (colorFilters.length > 0) {
      colorFilters.forEach((c) => {
        out.push({ key: `color_${c}`, label: `Màu: ${c}` });
      });
    }

    if (sizeFilters.length > 0) {
      sizeFilters.forEach((s) => {
        out.push({ key: `size_${s}`, label: `Size: ${s}` });
      });
    }

    const s = SORT_OPTIONS.find((x) => x.key === sortKey);
    if (s && s.key !== "default") {
      out.push({ key: `sort_${s.key}`, label: `Sắp xếp: ${s.label}` });
    }

    return out;
  }, [
    typeFrame,
    typeLens,
    typeSunglasses,
    typeContactLens,
    typeAccessory,
    onlyInStock,
    onlyPreorder,
    priceKey,
    sortKey,
    brandFilter,
    colorFilters,
    sizeFilters,
  ]);

  const removeChip = (chipKey) => {
    switch (chipKey) {
      case "type_frame":
        setTypeFrame(false);
        return;
      case "type_lens":
        setTypeLens(false);
        return;
      case "type_sunglasses":
        setTypeSunglasses(false);
        return;
      case "type_contact_lens":
        setTypeContactLens(false);
        return;
      case "type_accessory":
        setTypeAccessory(false);
        return;
      case "in_stock":
        setOnlyInStock(false);
        return;
      case "preorder":
        setOnlyPreorder(false);
        return;
      default:
        if (chipKey.startsWith("price_")) {
          setPriceKey("all");
          return;
        }
        if (chipKey.startsWith("sort_")) {
          setSortKey("default");
          return;
        }
        if (chipKey.startsWith("brand_")) {
          setBrandFilter(null);
          return;
        }
        if (chipKey.startsWith("color_")) {
          const colorId = chipKey.replace("color_", "");
          setColorFilters((prev) => prev.filter((c) => c !== colorId));
          return;
        }
        if (chipKey.startsWith("size_")) {
          const size = chipKey.replace("size_", "");
          setSizeFilters((prev) => prev.filter((s) => s !== size));
        }
    }
  };

  const clearAll = () => {
    setOnlyInStock(false);
    setOnlyPreorder(false);
    setTypeFrame(false);
    setTypeLens(false);
    setTypeSunglasses(false);
    setTypeContactLens(false);
    setTypeAccessory(false);
    setPriceKey("all");
    setSortKey("default");
    setBrandFilter(null);
    setColorFilters([]);
    setSizeFilters([]);
  };

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();

    let arr = products.filter((p) => {
      if (!q) return true;
      return (p.name || "").toLowerCase().includes(q);
    });

    const activeTypes = [];
    if (typeFrame) activeTypes.push("FRAME");
    if (typeLens) activeTypes.push("LENS");
    if (typeSunglasses) activeTypes.push("SUNGLASSES");
    if (typeContactLens) activeTypes.push("CONTACT_LENS");
    if (typeAccessory) activeTypes.push("ACCESSORY");

    if (activeTypes.length > 0) {
      arr = arr.filter((p) => activeTypes.includes(String(p.catalogType || "").toUpperCase()));
    }

    if (onlyInStock && !onlyPreorder) {
      arr = arr.filter((p) => p.stockStatus === "IN_STOCK");
    }
    if (onlyPreorder && !onlyInStock) {
      arr = arr.filter((p) => p.stockStatus === "PREORDER");
    }

    const pr = PRICE_RANGES.find((x) => x.key === priceKey) || PRICE_RANGES[0];
    if (pr.min != null) arr = arr.filter((p) => (p.price ?? 0) >= pr.min);
    if (pr.max != null) arr = arr.filter((p) => (p.price ?? 0) <= pr.max);

    if (brandFilter) {
      arr = arr.filter((p) => p.brand === brandFilter);
    }

    if (colorFilters.length > 0) {
      arr = arr.filter((p) => {
        if (!p.colors || p.colors.length === 0) return false;
        return colorFilters.some((cf) => p.colors.some((c) => c.id === cf));
      });
    }

    if (sizeFilters.length > 0) {
      arr = arr.filter((p) => {
        if (!p.sizes || p.sizes.length === 0) return false;
        return sizeFilters.some((sf) => p.sizes.includes(sf));
      });
    }

    const sorted = [...arr];
    switch (sortKey) {
      case "best":
        sorted.sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0));
        break;
      case "name_asc":
        sorted.sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), "vi"));
        break;
      case "name_desc":
        sorted.sort((a, b) => normalizeText(b.name).localeCompare(normalizeText(a.name), "vi"));
        break;
      case "price_asc":
        sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
      case "price_desc":
        sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case "discount_desc":
        sorted.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0));
        break;
      case "rating_desc":
        sorted.sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
        break;
      default:
        break;
    }

    return sorted;
  }, [
    products,
    query,
    typeFrame,
    typeLens,
    typeSunglasses,
    typeContactLens,
    typeAccessory,
    onlyInStock,
    onlyPreorder,
    priceKey,
    sortKey,
    brandFilter,
    colorFilters,
    sizeFilters,
  ]);

  const sortLabel = useMemo(() => {
    return SORT_OPTIONS.find((x) => x.key === sortKey)?.label ?? "Mặc định";
  }, [sortKey]);

  const selectedStoreLabel = useMemo(() => {
    const selectedStore = stores.find((store) => store.id === selectedStoreId);
    return selectedStore?.name || "Tất cả cửa hàng";
  }, [selectedStoreId, stores]);

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

          <Text style={styles.headerTitle}>Sản phẩm</Text>
        </View>

        <View style={styles.iconBtn} />
      </View>

      <View style={styles.searchWrap}>
        <HeaderSearchActions
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm gọng kính, tròng kính, dịch vụ..."
          onPressFav={() => navigation.navigate("FavTab")}
          onPressCart={() => navigation.navigate("CartFlow", { screen: "Cart" })}
        />
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        showsVerticalScrollIndicator
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
        ListHeaderComponent={
          <>
            <View style={styles.headerMeta}>
              <View style={styles.headerMetaMain}>
                <View style={styles.headerMetaText}>
                  <Text style={styles.countText}>{data.length} sản phẩm</Text>
                  <Text style={styles.subText}>
                    {sortKey === "default" ? "Theo bộ lọc hiện tại" : `Đang: ${sortLabel}`}
                  </Text>
                </View>

                {/* Đã cập nhật: Nút Sắp xếp & Bộ lọc được dời lên đây thay vì nút chọn Cửa hàng */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    style={styles.pillBtn}
                    activeOpacity={0.85}
                    onPress={() => setSortOpen(true)}
                  >
                    <Ionicons name="swap-vertical-outline" size={16} color={PALETTE.navy} />
                    <Text style={styles.pillBtnText}>Sắp xếp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.pillBtn}
                    activeOpacity={0.85}
                    onPress={() => setFilterOpen(true)}
                  >
                    <Ionicons name="options-outline" size={16} color={PALETTE.navy} />
                    <Text style={styles.pillBtnText}>Bộ lọc</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Đã cập nhật: Nút Cửa hàng được dời xuống ScrollView bên dưới */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionRow}
            >
              <TouchableOpacity
                style={styles.pillBtn}
                activeOpacity={0.85}
                onPress={() => setStoreOpen(true)}
              >
                <Ionicons name="business-outline" size={16} color={PALETTE.navy} />
                <Text style={styles.pillBtnText} numberOfLines={1}>
                  {selectedStoreLabel}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.appliedRow}
            >
              {appliedChips.length === 0 ? (
                <Chip label="Chưa áp dụng bộ lọc" />
              ) : (
                appliedChips.map((c) => (
                  <Chip
                    key={c.key}
                    label={c.label}
                    onRemove={() => removeChip(c.key)}
                  />
                ))
              )}

              {appliedChips.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={clearAll}
                  style={styles.clearAllBtn}
                >
                  <Text style={styles.clearAllText}>Xóa tất cả</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => (
          <View style={{ width: CARD_W }}>
            <ProductCard
              item={item}
              initialFav={favoriteIds.includes(String(item.id))}
              onFavoriteChanged={handleFavoriteChanged}
              onPress={() =>
                navigation.navigate("ProductDetail", { item, id: item.apiId })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {isLoading ? "Đang tải sản phẩm..." : "Không tìm thấy sản phẩm"}
            </Text>
            {!isLoading && (
              <Text style={styles.emptySub}>
                Thử đổi từ khóa hoặc xoá bộ lọc để xem thêm.
              </Text>
            )}
            {isError && !isLoading && (
              <Text style={styles.emptySub}>Không tải được dữ liệu từ API.</Text>
            )}
          </View>
        }
        ListFooterComponent={<View style={{ height: 16 }} />}
      />

      <BottomSheet
        visible={sortOpen}
        title="Sắp xếp"
        onClose={() => setSortOpen(false)}
      >
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, active && styles.optionRowActive]}
                activeOpacity={0.85}
                onPress={() => {
                  setSortKey(opt.key);
                  setSortOpen(false);
                }}
              >
                <View style={styles.optionRowMain}>
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={active ? PALETTE.navy : PALETTE.muted}
                  />
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {opt.label}
                  </Text>
                </View>
                {active && <Ionicons name="checkmark" size={18} color={PALETTE.gold} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={storeOpen}
        title="Chọn cửa hàng"
        onClose={() => setStoreOpen(false)}
      >
        <ScrollView
          style={styles.sheetScroll}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}
        >
          <TouchableOpacity
            style={[
              styles.optionRow,
              !selectedStoreId && styles.optionRowActive,
            ]}
            activeOpacity={0.85}
            onPress={() => {
              void setSelectedStoreId(null);
              setStoreOpen(false);
            }}
          >
            <Text style={[styles.optionText, !selectedStoreId && styles.optionTextActive]}>
              Tất cả cửa hàng
            </Text>
            {!selectedStoreId ? <Ionicons name="checkmark" size={18} color={PALETTE.gold} /> : null}
          </TouchableOpacity>

          {stores.map((store) => {
            const active = selectedStoreId === store.id;
            return (
              <TouchableOpacity
                key={store.id}
                style={[
                  styles.optionRow,
                  styles.optionRowMultiline,
                  active && styles.optionRowActive,
                ]}
                activeOpacity={0.85}
                onPress={() => {
                  void setSelectedStoreId(store.id);
                  setStoreOpen(false);
                }}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {store.name} ({store.code})
                  </Text>
                  <Text style={styles.optionSubText}>
                    {[store.addressLine1, store.district, store.city].filter(Boolean).join(", ") || "Chưa có địa chỉ"}
                  </Text>
                </View>
                {active ? <Ionicons name="checkmark" size={18} color={PALETTE.gold} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={filterOpen}
        title="Bộ lọc"
        onClose={() => setFilterOpen(false)}
      >
        <ScrollView
          style={styles.sheetScroll}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24, gap: 14 }}
        >
          <View style={{ gap: 8 }}>
            <Text style={styles.groupTitle}>Loại</Text>
            <View style={styles.rowWrap}>
              <TouchableOpacity
                style={[styles.togglePill, typeFrame && styles.togglePillActive]}
                activeOpacity={0.85}
                onPress={() => setTypeFrame((v) => !v)}
              >
                <Text style={[styles.toggleText, typeFrame && styles.toggleTextActive]}>
                  Gọng kính
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.togglePill, typeLens && styles.togglePillActive]}
                activeOpacity={0.85}
                onPress={() => setTypeLens((v) => !v)}
              >
                <Text style={[styles.toggleText, typeLens && styles.toggleTextActive]}>
                  Tròng kính
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.togglePill, typeSunglasses && styles.togglePillActive]}
                activeOpacity={0.85}
                onPress={() => setTypeSunglasses((v) => !v)}
              >
                <Text style={[styles.toggleText, typeSunglasses && styles.toggleTextActive]}>
                  Kính mát
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.togglePill, typeContactLens && styles.togglePillActive]}
                activeOpacity={0.85}
                onPress={() => setTypeContactLens((v) => !v)}
              >
                <Text style={[styles.toggleText, typeContactLens && styles.toggleTextActive]}>
                  Kính áp tròng
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.togglePill, typeAccessory && styles.togglePillActive]}
                activeOpacity={0.85}
                onPress={() => setTypeAccessory((v) => !v)}
              >
                <Text style={[styles.toggleText, typeAccessory && styles.toggleTextActive]}>
                  Phụ kiện
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.groupTitle}>Trạng thái</Text>
            <View style={styles.rowWrap}>
              <TouchableOpacity
                style={[styles.togglePill, onlyInStock && styles.togglePillActive]}
                activeOpacity={0.85}
                onPress={() => setOnlyInStock((v) => !v)}
              >
                <Text style={[styles.toggleText, onlyInStock && styles.toggleTextActive]}>
                  Có sẵn
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.togglePill, onlyPreorder && styles.togglePillActive]}
                activeOpacity={0.85}
                onPress={() => setOnlyPreorder((v) => !v)}
              >
                <Text style={[styles.toggleText, onlyPreorder && styles.toggleTextActive]}>
                  Đặt trước
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.groupTitle}>Khoảng giá</Text>
            <View style={{ gap: 8 }}>
              {PRICE_RANGES.map((r) => {
                const active = priceKey === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    activeOpacity={0.85}
                    onPress={() => setPriceKey(r.key)}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {r.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={PALETTE.gold} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.groupTitle}>Thương hiệu</Text>
            <View style={{ gap: 8 }}>
              {["Ray-Ban", "Essilor", "Warby Parker", "Oakley"].map((brand) => {
                const active = brandFilter === brand;
                return (
                  <TouchableOpacity
                    key={brand}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    activeOpacity={0.85}
                    onPress={() => setBrandFilter(active ? null : brand)}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {brand}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={PALETTE.gold} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.groupTitle}>Màu sắc</Text>
            <View style={styles.colorFilterRow}>
              {[
                { id: "black", name: "Đen", hex: "#111111" },
                { id: "navy", name: "Xanh", hex: "#374151" },
                { id: "beige", name: "Be", hex: "#D6C9B4" },
                { id: "gold", name: "Vàng", hex: "#C9A227" },
                { id: "silver", name: "Bạc", hex: "#9CA3AF" },
                { id: "red", name: "Đỏ", hex: "#B91C1C" },
                { id: "blue", name: "Xanh dương", hex: "#1E40AF" },
                { id: "green", name: "Xanh lá", hex: "#047857" },
              ].map((color) => {
                const active = colorFilters.includes(color.id);
                return (
                  <TouchableOpacity
                    key={color.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      setColorFilters((prev) =>
                        active ? prev.filter((c) => c !== color.id) : [...prev, color.id]
                      );
                    }}
                    style={[
                      styles.colorFilterDot,
                      active && styles.colorFilterDotActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.colorFilterInner,
                        { backgroundColor: color.hex },
                      ]}
                    />
                    {active && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={PALETTE.navy}
                        style={styles.colorFilterCheck}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.groupTitle}>Kích thước</Text>
            <View style={styles.rowWrap}>
              {["S", "M", "L", "XL"].map((size) => {
                const active = sizeFilters.includes(size);
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.togglePill, active && styles.togglePillActive]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSizeFilters((prev) =>
                        active ? prev.filter((s) => s !== size) : [...prev, size]
                      );
                    }}
                  >
                    <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: PALETTE.white }]}
              activeOpacity={0.85}
              onPress={clearAll}
            >
              <Text style={[styles.actionBtnText, { color: PALETTE.navy }]}>
                Xóa tất cả
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: PALETTE.navy }]}
              activeOpacity={0.85}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={[styles.actionBtnText, { color: PALETTE.white }]}>
                Áp dụng
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheet>
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
    justifyContent: "space-between",
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

  searchWrap: {
    marginHorizontal: PAGE_PADDING,
    marginBottom: 10,
  },

  headerMeta: {
    marginTop: 2,
    marginBottom: 10,
  },
  headerMetaMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerMetaText: {
    flex: 1,
    minWidth: 0,
  },
  countText: { fontSize: 13, fontWeight: "800", color: PALETTE.navy },
  subText: { fontSize: 12, fontWeight: "600", color: PALETTE.muted, marginTop: 2 },

  actionRow: {
    paddingBottom: 10,
    paddingRight: 2,
    gap: 10,
    alignItems: "center",
  },

  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PALETTE.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  storePillBtn: { maxWidth: "52%" },
  pillBtnText: { fontSize: 12.5, fontWeight: "800", color: PALETTE.navy },

  appliedRow: {
    paddingBottom: 10,
    paddingRight: 2,
    gap: 8,
    alignItems: "center",
  },
  appliedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PALETTE.white,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    height: 34,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  appliedChipText: { fontSize: 12, fontWeight: "800", color: PALETTE.text },
  chipX: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  clearAllBtn: { paddingHorizontal: 6, height: 34, justifyContent: "center" },
  clearAllText: { fontSize: 12, fontWeight: "800", color: "red" },

  listContent: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 8,
    paddingTop: 0,
  },

  emptyWrap: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: PALETTE.navy },
  emptySub: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(12,44,92,0.32)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: PALETTE.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    maxHeight: "78%",
  },
  sheetBody: {
    flexShrink: 1,
    minHeight: 0,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 15, fontWeight: "900", color: PALETTE.navy },

  groupTitle: { fontSize: 13, fontWeight: "900", color: PALETTE.navy },

  optionRow: {
    backgroundColor: PALETTE.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  optionRowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  optionRowMultiline: {
    alignItems: "flex-start",
  },
  optionContent: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  optionRowActive: {
    borderWidth: 1,
    borderColor: PALETTE.gold,
    backgroundColor: PALETTE.goldSoft,
  },
  optionText: { fontSize: 13, fontWeight: "800", color: PALETTE.text },
  optionTextActive: { color: PALETTE.navy },
  optionSubText: {
    marginTop: 4,
    fontSize: 11.5,
    fontWeight: "600",
    color: PALETTE.muted,
  },

  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  colorFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  colorFilterDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  colorFilterDotActive: {
    borderWidth: 2,
    borderColor: PALETTE.gold,
  },
  colorFilterInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorFilterCheck: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: PALETTE.white,
    borderRadius: 8,
    padding: 2,
  },

  togglePill: {
    backgroundColor: PALETTE.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  togglePillActive: {
    borderWidth: 1,
    borderColor: PALETTE.gold,
    backgroundColor: PALETTE.goldSoft,
  },
  toggleText: { fontSize: 12, fontWeight: "800", color: PALETTE.text },
  toggleTextActive: { color: PALETTE.navy },

  actionBtn: {
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  actionBtnText: { fontSize: 13, fontWeight: "900" },
});