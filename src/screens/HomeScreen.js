// screens/HomeScreen.js
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import HeaderSearchActions from "../components/HeaderSearchActions";
import HomeBanner from "../components/HomeBanner";
import HomeFooter from "../components/HomeFooter";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";
import { useAuthStore } from "../store/authStore";

const { width } = Dimensions.get("window");
const GAP = 12;
const PAGE_PADDING = 16;
const PAGE_W = width - PAGE_PADDING * 2;
const CARD_W = (PAGE_W - GAP) / 2;

const BANNERS = [
  {
    id: "b1",
    title: "Giảm 30% cho kính râm mùa hè",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1200&q=80",
  },
  {
    id: "b2",
    title: "Ưu đãi tròng kính chính hãng",
    image:
      "https://images.unsplash.com/photo-1520975958225-1c6f7b9c9a64?w=1200&q=80",
  },
  {
    id: "b3",
    title: "Mua 1 tặng 1 phụ kiện",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=1200&q=80",
  },
];

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ProductPager({ products = [], onPressItem }) {
  const pages = useMemo(() => chunkArray(products, 2), [products]);
  const [pageIndex, setPageIndex] = useState(0);

  if (!products?.length) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <FlatList
        data={pages}
        keyExtractor={(_, idx) => `page-${idx}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 2 }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
          setPageIndex(i);
        }}
        renderItem={({ item: pageItems }) => (
          <View style={{ width: PAGE_W, flexDirection: "row", gap: GAP }}>
            {pageItems.map((p) => (
              <View key={p.id} style={{ width: CARD_W }}>
                <ProductCard item={p} onPress={() => onPressItem?.(p)} />
              </View>
            ))}
            {pageItems.length === 1 && <View style={{ width: CARD_W }} />}
          </View>
        )}
      />

      {pages.length > 1 && (
        <View style={styles.pagerDots}>
          {pages.map((_, idx) => (
            <View
              key={idx}
              style={[styles.pagerDot, idx === pageIndex && styles.pagerDotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [query, setQuery] = useState("");
  const { products } = useProducts();

  const submitSearch = () => {
    const q = query.trim();
    navigation.navigate("ProductsTab", {
      screen: "Products",
      params: { q },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ HEADER (giống kiểu cũ bạn làm) */}
        <View style={styles.headerWrap}>
          {/* Row 1: location + login/logout (không title) */}
          <View style={styles.headerRow1}>
            <Pressable
              onPress={() => navigation.navigate?.("AddressBook")}
              style={styles.locationRow}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <Ionicons name="location-outline" size={16} color="#111827" />
              <Text style={styles.locationText} numberOfLines={1}>
                Giao đến: Quận 1, TP.HCM
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6B7280" />
            </Pressable>

            {token ? (
              <Pressable onPress={logout} style={styles.authBtn}>
                <Ionicons name="log-out-outline" size={14} color="#fff" />
                <Text style={styles.authText}>Logout</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => navigation.navigate("Login")}
                style={[styles.authBtn, { backgroundColor: "#4F46E5" }]}
              >
                <Ionicons name="log-in-outline" size={14} color="#fff" />
                <Text style={styles.authText}>Login</Text>
              </Pressable>
            )}
          </View>

          {/* Row 2: Search */}
          <HeaderSearchActions
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm gọng kính, tròng kính, dịch vụ..."
            onPressFav={() => navigation.navigate("FavTab")}
            onPressCart={() => navigation.navigate("CartFlow", { screen: "Cart" })}
            onSubmit={submitSearch}
          />
        </View>

        {/* BANNER */}
        <HomeBanner banners={BANNERS} autoPlay intervalMs={3000} />

        {/* SECTION: Bán chạy */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Bán chạy</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ProductsTab", { screen: "Products" })}
          >
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <ProductPager
          products={products}
          onPressItem={(item) => navigation.navigate("ProductDetail", { item })}
        />

        {/* SECTION: Mới về */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Mới về</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ProductsTab", { screen: "Products" })}
          >
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <ProductPager
          products={products}
          onPressItem={(item) => navigation.navigate("ProductDetail", { item })}
        />

        {/* SECTION: Combo */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Combo gọng + tròng</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ProductsTab", { screen: "Products" })}
          >
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <ProductPager
          products={products}
          onPressItem={(item) => navigation.navigate("ProductDetail", { item })}
        />

        <HomeFooter onChatPress={() => { }} onCallPress={() => { }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },
  listContent: { paddingHorizontal: PAGE_PADDING, paddingBottom: 24 },

  // ✅ header kiểu cũ, nhưng spacing gọn & đồng bộ
  headerWrap: {
    marginTop: 8,
    gap: 10,
    marginBottom: 10,
  },
  headerRow1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  locationRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
  },
  locationText: {
    fontSize: 12.5,
    color: "#111827",
    fontWeight: "800",
    flexShrink: 1,
  },

  authBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E11D48",
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 12,
  },
  authText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  sectionRow: {
    marginTop: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionLink: { fontSize: 13, fontWeight: "800", color: "#2563EB" },

  pagerDots: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  pagerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(17,24,39,0.25)",
  },
  pagerDotActive: {
    width: 18,
    borderRadius: 6,
    backgroundColor: "rgba(17,24,39,0.8)",
  },
});
