import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import HeaderSearchActions from "../components/HeaderSearchActions";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";

const { width } = Dimensions.get("window");
const PAGE_PADDING = 16;
const GAP = 12;
const CARD_W = (width - PAGE_PADDING * 2 - GAP) / 2;

// ===== Options =====
const SORT_OPTIONS = [
  { key: "default", label: "Mặc định" },
  { key: "best", label: "Bán chạy" },
  { key: "price_asc", label: "Giá tăng dần" },
  { key: "price_desc", label: "Giá giảm dần" },
  { key: "discount_desc", label: "Giảm giá nhiều" },
  { key: "rating_desc", label: "Đánh giá cao" },
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
          <Ionicons name="close" size={14} color="#6B7280" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function BottomSheet({ visible, title, onClose, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => { }}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProductsScreen({ navigation }) {
  const route = useRoute();
  const [query, setQuery] = useState("");
  const { products, isLoading, isError } = useProducts();

  useEffect(() => {
    const q = route?.params?.q;
    if (typeof q === "string") setQuery(q);
  }, [route?.params?.q]);

  // Filters
  const [onlyInStock, setOnlyInStock] = useState(false); // stockStatus === IN_STOCK
  const [onlyPreorder, setOnlyPreorder] = useState(false); // stockStatus === PREORDER
  const [typeFrame, setTypeFrame] = useState(false); // type === FRAME
  const [typeLens, setTypeLens] = useState(false); // type === LENS
  const [priceKey, setPriceKey] = useState("all");

  // Sort
  const [sortKey, setSortKey] = useState("default");

  // UI sheets
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // ===== Applied chips derived from state =====
  const appliedChips = useMemo(() => {
    const out = [];

    if (typeFrame) out.push({ key: "type_frame", label: "Gọng kính" });
    if (typeLens) out.push({ key: "type_lens", label: "Tròng kính" });

    if (onlyInStock) out.push({ key: "in_stock", label: "Có sẵn" });
    if (onlyPreorder) out.push({ key: "preorder", label: "Đặt trước" });

    const pr = PRICE_RANGES.find((x) => x.key === priceKey);
    if (pr && pr.key !== "all")
      out.push({ key: `price_${pr.key}`, label: pr.label });

    const s = SORT_OPTIONS.find((x) => x.key === sortKey);
    if (s && s.key !== "default")
      out.push({ key: `sort_${s.key}`, label: `Sắp xếp: ${s.label}` });

    return out;
  }, [typeFrame, typeLens, onlyInStock, onlyPreorder, priceKey, sortKey]);

  const removeChip = (chipKey) => {
    switch (chipKey) {
      case "type_frame":
        setTypeFrame(false);
        return;
      case "type_lens":
        setTypeLens(false);
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
    }
  };

  const clearAll = () => {
    setOnlyInStock(false);
    setOnlyPreorder(false);
    setTypeFrame(false);
    setTypeLens(false);
    setPriceKey("all");
    setSortKey("default");
  };

  // ===== Filter + Search + Sort pipeline =====
  const data = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1) search
    let arr = products.filter((p) => {
      if (!q) return true;
      return (p.name || "").toLowerCase().includes(q);
    });

    // 2) filters
    // type
    if (typeFrame && !typeLens) arr = arr.filter((p) => p.type === "FRAME");
    if (typeLens && !typeFrame) arr = arr.filter((p) => p.type === "LENS");

    // stock
    if (onlyInStock && !onlyPreorder)
      arr = arr.filter((p) => p.stockStatus === "IN_STOCK");
    if (onlyPreorder && !onlyInStock)
      arr = arr.filter((p) => p.stockStatus === "PREORDER");

    // price
    const pr = PRICE_RANGES.find((x) => x.key === priceKey) || PRICE_RANGES[0];
    if (pr.min != null) arr = arr.filter((p) => (p.price ?? 0) >= pr.min);
    if (pr.max != null) arr = arr.filter((p) => (p.price ?? 0) <= pr.max);

    // 3) sort
    const sorted = [...arr];
    switch (sortKey) {
      case "best":
        sorted.sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0));
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
    onlyInStock,
    onlyPreorder,
    priceKey,
    sortKey,
  ]);

  const sortLabel = useMemo(() => {
    return SORT_OPTIONS.find((x) => x.key === sortKey)?.label ?? "Mặc định";
  }, [sortKey]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      {/* <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() =>
              navigation?.canGoBack?.() ? navigation.goBack() : null
            }
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Sản phẩm</Text>
        </View>
      </View> */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
            activeOpacity={0.85}
            style={styles.iconBtn} // ✅ giống Fav
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Sản phẩm</Text>
        </View>

        {/* bên phải để trống như Fav (hoặc để placeholder nếu bạn muốn cân tuyệt đối) */}
        <View style={styles.iconBtn} />
      </View>

      {/* Search + Fav + Cart */}
      <View style={styles.searchWrap}>
        <HeaderSearchActions
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm gọng kính, tròng kính, dịch vụ..."
          onPressFav={() => navigation.navigate("FavTab")}
          onPressCart={() => navigation.navigate("CartFlow", { screen: "Cart" })}
        />
      </View>

      {/* ✅ FlatList là scroll chính: TopBar + Chips nằm trong header của list */}
      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Top controls */}
            <View style={styles.topBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.countText}>{data.length} sản phẩm</Text>
                <Text style={styles.subText}>
                  {sortKey === "default"
                    ? "Theo bộ lọc hiện tại"
                    : `Đang: ${sortLabel}`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.pillBtn}
                activeOpacity={0.85}
                onPress={() => setSortOpen(true)}
              >
                <Ionicons name="swap-vertical" size={16} color="#111827" />
                <Text style={styles.pillBtnText}>Sắp xếp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pillBtn}
                activeOpacity={0.85}
                onPress={() => setFilterOpen(true)}
              >
                <Ionicons name="options-outline" size={16} color="#111827" />
                <Text style={styles.pillBtnText}>Bộ lọc</Text>
              </TouchableOpacity>
            </View>

            {/* Applied chips row */}
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
              onPress={() => navigation.navigate("ProductDetail", { item })}
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

      {/* SORT SHEET */}
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
                <Text
                  style={[
                    styles.optionText,
                    active && styles.optionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {active && (
                  <Ionicons name="checkmark" size={18} color="#111827" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* FILTER SHEET */}
      <BottomSheet
        visible={filterOpen}
        title="Bộ lọc"
        onClose={() => setFilterOpen(false)}
      >
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 14 }}>
          {/* TYPE */}
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
            </View>
          </View>

          {/* STOCK */}
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

          {/* PRICE */}
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
                    {active && (
                      <Ionicons name="checkmark" size={18} color="#111827" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ACTIONS */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: "#FFFFFF" }]}
              activeOpacity={0.85}
              onPress={clearAll}
            >
              <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>
                Xóa tất cả
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: "#111827" }]}
              activeOpacity={0.85}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
                Áp dụng
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },

  // header: {
  //   paddingHorizontal: 12,
  //   paddingTop: 6,
  //   paddingBottom: 10,
  //   flexDirection: "row",
  //   alignItems: "center",
  //   justifyContent: "space-between",
  // },
  // headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  // headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
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

  // ✅ nằm trong ListHeaderComponent
  topBar: {
    paddingHorizontal: PAGE_PADDING,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    marginTop: 2,
  },
  countText: { fontSize: 13, fontWeight: "800", color: "#111827" },
  subText: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginTop: 2 },

  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
  },
  pillBtnText: { fontSize: 12.5, fontWeight: "800", color: "#111827" },

  appliedRow: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 10,
    gap: 8,
    alignItems: "center",
  },
  appliedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    height: 34,
    maxWidth: 220,
  },
  appliedChipText: { fontSize: 12, fontWeight: "800", color: "#111827" },
  chipX: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },

  clearAllBtn: { paddingHorizontal: 6, height: 34, justifyContent: "center" },
  clearAllText: { fontSize: 12, fontWeight: "800", color: "#EF4444" },

  // ✅ list padding
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
  emptyTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  emptySub: { fontSize: 12, fontWeight: "700", color: "#6B7280", textAlign: "center" },

  // ===== Modal / Sheet =====
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#F6F7FB",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    maxHeight: "78%",
  },
  sheetHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 15, fontWeight: "900", color: "#111827" },

  groupTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },

  optionRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionRowActive: {
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.15)",
  },
  optionText: { fontSize: 13, fontWeight: "800", color: "#111827" },
  optionTextActive: { color: "#111827" },

  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  togglePill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  togglePillActive: {
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.18)",
  },
  toggleText: { fontSize: 12, fontWeight: "800", color: "#111827" },
  toggleTextActive: { color: "#111827" },

  actionBtn: {
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 13, fontWeight: "900" },
});
