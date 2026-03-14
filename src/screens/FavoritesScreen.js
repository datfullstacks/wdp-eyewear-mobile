// src/screens/FavoritesScreen.js
import React, { useCallback, useMemo, useState } from "react";
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import ProductCard from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";
import {
  clearMyFavoritesApi,
  getMyFavoriteIdsApi,
  removeMyFavoriteApi,
} from "../services/userService";

const { width } = Dimensions.get("window");
const PAGE_PADDING = 16;
const GAP = 12;
const CARD_W = (width - PAGE_PADDING * 2 - GAP) / 2;

export default function FavoritesScreen({ navigation }) {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [loadingFavs, setLoadingFavs] = useState(true);
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
      console.log("Loaded favorite IDs:", ids);
    } catch (err) {
      console.log("loadFavorites error:", err);
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
      console.log(`Removed favorite ${id}. Updated IDs:`, remoteIds);
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
      console.log("Cleared favorites. Updated IDs:", remoteIds);
    } catch {
      setFavoriteIds(prev);
    }
  }, [favoriteIds]);

  const data = useMemo(() => {
    const setIds = new Set(favoriteIds.map(String));
    return products.filter((p) => setIds.has(String(p.id)));
  }, [favoriteIds, products]);

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
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yêu thích</Text>
        </View>

        {data.length > 0 && (
          <TouchableOpacity
            onPress={handleClearFavorites}
            activeOpacity={0.85}
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#111827" />
          </TouchableOpacity>
        )}
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
            <Ionicons name="heart-outline" size={44} color="#9CA3AF" />
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
    </SafeAreaView>
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  listContent: { paddingHorizontal: PAGE_PADDING, paddingBottom: 8 },

  emptyWrap: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  emptySub: { fontSize: 12, fontWeight: "700", color: "#6B7280", textAlign: "center" },

  goBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },
  goBtnText: { color: "#fff", fontWeight: "900" },
});