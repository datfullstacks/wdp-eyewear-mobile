// src/screens/FavoritesScreen.js
import React, { useMemo, useEffect } from "react";
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import ProductCard from "../components/ProductCard";
import { MOCK_PRODUCTS } from "../data/mockProducts";
import { useFavoriteStore } from "../store/favoriteStore";

const { width } = Dimensions.get("window");
const PAGE_PADDING = 16;
const GAP = 12;
const CARD_W = (width - PAGE_PADDING * 2 - GAP) / 2;

export default function FavoritesScreen({ navigation }) {
  const ids = useFavoriteStore((s) => s.ids);
  const isHydrating = useFavoriteStore((s) => s.isHydrating);
  const hydrate = useFavoriteStore((s) => s.hydrate);
  const toggle = useFavoriteStore((s) => s.toggle);
  const clear = useFavoriteStore((s) => s.clear);

  useEffect(() => {
    if (isHydrating) hydrate();
  }, [isHydrating, hydrate]);

  const data = useMemo(() => {
    const setIds = new Set(ids);
    return MOCK_PRODUCTS.filter((p) => setIds.has(p.id));
  }, [ids]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
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
          <TouchableOpacity onPress={clear} activeOpacity={0.85} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color="#111827" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={{ width: CARD_W }}>
            <ProductCard
              item={item}
              isFav
              onPressFav={() => toggle(item)}
              onPress={() => navigation.navigate("ProductDetail", { item })}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="heart-outline" size={44} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Chưa có sản phẩm yêu thích</Text>
            <Text style={styles.emptySub}>Hãy bấm ♥ ở sản phẩm để lưu lại nhé.</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.goBtn}
              onPress={() => navigation.navigate("ProductsTab", { screen: "Products" })}
            >
              <Text style={styles.goBtnText}>Đi mua sắm</Text>
            </TouchableOpacity>
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
