// src/screens/FavoritesScreen.js
import React, { useCallback, useMemo, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import ProductCard from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";
import {
  clearMyFavoritesApi,
  getMyFavoriteIdsApi,
  removeMyFavoriteApi,
} from "../services/userService";

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
  { key: "name_asc", label: "Tên A-Z", icon: "text-outline" },
  { key: "name_desc", label: "Tên Z-A", icon: "text-outline" },
  { key: "price_asc", label: "Giá tăng dần", icon: "arrow-up-outline" },
  { key: "price_desc", label: "Giá giảm dần", icon: "arrow-down-outline" },
];

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

export default function FavoritesScreen({ navigation }) {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [loadingFavs, setLoadingFavs] = useState(true);
  const [sortBy, setSortBy] = useState("default");
  const [showSortModal, setShowSortModal] = useState(false);
  const { products, isLoading } = useProducts();

  const normalizeFavoriteIds = (payload) => {
    if (Array.isArray(payload)) return payload.map(String);
    if (Array.isArray(payload?.items)) return payload.items.map(String);
    if (Array.isArray(payload?.data)) return payload.data.map(String);
    if (Array.isArray(payload?.favoriteIds)) return payload.favoriteIds.map(String);
    return [];
  };

  const loadFavorites = useCallback(async () => {
    try {
      setLoadingFavs(true);
      const result = await getMyFavoriteIdsApi();
      const ids = normalizeFavoriteIds(result);
      setFavoriteIds(ids);
      // console.log("Loaded favorite IDs:", ids);
    } catch (err) {
      // console.log("loadFavorites error:", err);
      setFavoriteIds([]);
    } finally {
      setLoadingFavs(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const handleRemoveFavorite = useCallback(async (productId) => {
    const id = String(productId);
    const prev = favoriteIds;

    setFavoriteIds((curr) => curr.filter((x) => x !== id));

    try {
      const remoteIds = await removeMyFavoriteApi(id);
      setFavoriteIds(Array.isArray(remoteIds) ? remoteIds.map(String) : []);
      // console.log(`Removed favorite ${id}. Updated IDs:`, remoteIds);
    } catch {
      setFavoriteIds(prev);
    }
  }, [favoriteIds]);

  const handleClearFavorites = useCallback(async () => {
    const prev = favoriteIds;
    setFavoriteIds([]);

    try {
      const remoteIds = await clearMyFavoritesApi();
      setFavoriteIds(Array.isArray(remoteIds) ? remoteIds.map(String) : []);
      // console.log("Cleared favorites. Updated IDs:", remoteIds);
    } catch {
      setFavoriteIds(prev);
    }
  }, [favoriteIds]);

  const data = useMemo(() => {
    const setIds = new Set(favoriteIds.map(String));
    let arr = products.filter((p) => setIds.has(String(p.id)));

    const sorted = [...arr];
    switch (sortBy) {
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
      default:
        break;
    }

    return sorted;
  }, [favoriteIds, products, sortBy]);

  const getSortButtonLabel = () => {
    switch (sortBy) {
      case "name_asc":
        return "Tên A-Z";
      case "name_desc":
        return "Tên Z-A";
      case "price_asc":
        return "Giá ↑";
      case "price_desc":
        return "Giá ↓";
      default:
        return "Sắp xếp";
    }
  };

  const isPageLoading = isLoading || loadingFavs;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
            activeOpacity={0.85}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yêu thích</Text>
        </View>

        <View style={styles.headerRight}>
          {data.length > 0 && (
            <TouchableOpacity
              style={[styles.sortBtn, showSortModal && styles.sortBtnActive]}
              onPress={() => setShowSortModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={14}
                color={PALETTE.navy}
              />
              <Text
                style={[
                  styles.sortBtnText,
                  showSortModal && styles.sortBtnTextActive,
                ]}
              >
                {getSortButtonLabel()}
              </Text>
            </TouchableOpacity>
          )}

          {data.length > 0 && (
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={handleClearFavorites}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={PALETTE.navy} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => String(it.id)}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={{ width: CARD_W }}>
            <ProductCard
              item={item}
              initialFav={true}
              onFavoriteChanged={(nextFav) => {
                if (!nextFav) handleRemoveFavorite(item.id);
              }}
              onPress={() =>
                navigation.navigate("ProductDetail", { item, id: item.apiId || item.id })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="heart-outline" size={44} color="#EF4444" />
            <Text style={styles.emptyTitle}>
              {isPageLoading ? "Đang tải danh sách..." : "Chưa có sản phẩm yêu thích"}
            </Text>
            {!isPageLoading && (
              <Text style={styles.emptySub}>
                Hãy bấm ♥ ở sản phẩm để lưu lại nhé.
              </Text>
            )}
            {!isPageLoading && (
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.goBtn}
                onPress={() => navigation.navigate("ProductsTab", { screen: "Products" })}
              >
                <Text style={styles.goBtnText}>Đi khám phá sản phẩm</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={<View style={{ height: 16 }} />}
      />

      <BottomSheet
        visible={showSortModal}
        title="Sắp xếp"
        onClose={() => setShowSortModal(false)}
      >
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
          {SORT_OPTIONS.map((option) => {
            const active = sortBy === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionRow, active && styles.optionRowActive]}
                activeOpacity={0.85}
                onPress={() => {
                  setSortBy(option.key);
                  setShowSortModal(false);
                }}
              >
                <View style={styles.optionRowMain}>
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={active ? PALETTE.navy : PALETTE.muted}
                  />
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                </View>
                {active ? <Ionicons name="checkmark" size={18} color={PALETTE.gold} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
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
  headerTitle: { fontSize: 16, fontWeight: "900", color: PALETTE.text },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  sortBtnActive: {
    backgroundColor: PALETTE.navyTint,
    borderColor: PALETTE.navy,
  },

  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: PALETTE.navy,
  },

  sortBtnTextActive: {
    color: PALETTE.navy,
  },

  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    position: "relative",
  },

  listContent: { paddingHorizontal: PAGE_PADDING, paddingBottom: 8 },

  emptyWrap: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: PALETTE.navy },
  emptySub: { fontSize: 12, fontWeight: "700", color: PALETTE.muted, textAlign: "center" },

  goBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PALETTE.navy,
  },
  goBtnText: { color: PALETTE.white, fontWeight: "900" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(12,44,92,0.32)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: PALETTE.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    maxHeight: "50%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: PALETTE.navy },
  sheetBody: { paddingHorizontal: 16, paddingTop: 8 },

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
  optionRowActive: {
    borderWidth: 1,
    borderColor: PALETTE.gold,
    backgroundColor: PALETTE.goldSoft,
  },
  optionText: { fontSize: 13, fontWeight: "800", color: PALETTE.text },
  optionTextActive: { color: PALETTE.navy },
});