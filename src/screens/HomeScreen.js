import React, { useMemo } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import ProductCard from "../components/ProductCard";
import HomeBanner from "../components/HomeBanner";
import HomeFooter from "../components/HomeFooter";


const { width } = Dimensions.get("window");
const GAP = 12;
const PAGE_W = width - 32; // paddingHorizontal 16*2
const CARD_W = (PAGE_W - GAP) / 2; // 2 cột

const PAGE_SIZE = 4; // ✅ đổi số này để tuỳ số lượng 1 lượt

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

const CATEGORIES = [
  { id: "1", label: "Gọng kính", lib: "fa5", icon: "glasses" },
  { id: "2", label: "Tròng kính", lib: "ion", icon: "aperture-outline" },
  { id: "3", label: "Kính râm", lib: "ion", icon: "glasses" },
  { id: "4", label: "Phụ kiện", lib: "ion", icon: "bag-handle-outline" },
  { id: "5", label: "Dịch vụ", lib: "ion", icon: "construct-outline" },
];

const FILTER_CHIPS = ["In-stock", "Pre-order", "Làm kính theo đơn"];

const PRODUCTS = [
  {
    id: "p1",
    name: "Gọng kính Kim loại Oval",
    price: 790000,
    discountPct: 20,
    status: "In-stock",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80",
    color: ["Gold", "Silver", "Red"],
  },
  {
    id: "p2",
    name: "Kính râm Polarized UV400",
    price: 1290000,
    status: "In-stock",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Gold", "Blue", "Black"],
  },
  {
    id: "p3",
    name: "Gọng kính Vuông",
    price: 890000,
    discountPct: 15,
    status: "Pre-order",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Pink", "Silver", "Black"],
  },
  {
    id: "p4",
    name: "Gọng kính Vuông",
    price: 890000,
    discountPct: 15,
    status: "Pre-order",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Pink", "Silver", "Black"],
  },
  {
    id: "p5",
    name: "Gọng kính Vuông",
    price: 890000,
    discountPct: 15,
    status: "Pre-order",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Pink", "Silver", "Black"],
  },
  {
    id: "p6",
    name: "Gọng kính Vuông",
    price: 890000,
    discountPct: 15,
    status: "Pre-order",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Pink", "Silver", "Black"],
  },
  {
    id: "p7",
    name: "Gọng kính Vuông",
    price: 890000,
    discountPct: 15,
    status: "Pre-order",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Pink", "Silver", "Black"],
  },
  {
    id: "p8",
    name: "Gọng kính Vuông",
    price: 890000,
    discountPct: 15,
    status: "Pre-order",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Pink", "Silver", "Black"],
  },
];

// ===== Helper: chunk array theo pageSize =====
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ===== Component: ProductPager (mỗi page = grid 2x2) =====
function ProductPager({ products = [], pageSize = 4, onPressItem }) {
  const pages = useMemo(() => chunkArray(products, pageSize), [products, pageSize]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const cardWrapStyle = useMemo(() => ({ width: CARD_W }), []);

  if (!products?.length) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <FlatList
        data={pages}
        keyExtractor={(_, idx) => `page-${idx}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
          setPageIndex(i);
        }}
        renderItem={({ item: pageItems }) => {
          return (
            <View style={{ width: PAGE_W }}>
              <FlatList
                data={pageItems}
                keyExtractor={(it) => it.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: GAP }}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <View style={cardWrapStyle}>
                    <ProductCard item={item} onPress={() => onPressItem?.(item)} />
                  </View>
                )}
              />
            </View>
          );
        }}
      />

      {/* Dots indicator */}
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
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Dùng ScrollView để vẫn scroll dọc toàn trang */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerWrap}>
          {/* Row 1: Location + Logout */}
          <View style={styles.headerRow1}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color="#111827" />
              <Text style={styles.locationText} numberOfLines={1}>
                Giao đến: Quận 1, TP.HCM
              </Text>
            </View>

            <Pressable onPress={logout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={14} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          {/* Row 2: Search + Icons */}
          <View style={styles.headerRow2}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#9AA4B2" />
              <TextInput
                placeholder="Tìm gọng kính, tròng kính, dịch vụ..."
                placeholderTextColor="#9AA4B2"
                style={styles.searchInput}
              />
            </View>

            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8}>
              <Ionicons name="heart-outline" size={18} color="#111827" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8}>
              <Ionicons name="cart-outline" size={18} color="#111827" />
              <View style={styles.cartDot}>
                <Text style={styles.cartDotText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* BANNER */}
        <HomeBanner banners={BANNERS} autoPlay intervalMs={3000} />

        {/* CATEGORIES */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c.id} style={styles.catItem} activeOpacity={0.85}>
              <View style={styles.catIcon}>
                {c.lib === "fa5" ? (
                  <FontAwesome5 name={c.icon} size={18} color="#111827" solid />
                ) : (
                  <Ionicons name={c.icon} size={20} color="#111827" />
                )}
              </View>
              <Text style={styles.catLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* CHIPS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTER_CHIPS.map((t) => (
            <TouchableOpacity key={t} style={styles.chip} activeOpacity={0.85}>
              <Text style={styles.chipText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SECTION */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Bán chạy</Text>
          <TouchableOpacity activeOpacity={0.8}>
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ PRODUCTS: mỗi lượt 4 sp, vuốt ngang qua trang tiếp theo */}
        <ProductPager
          products={PRODUCTS}
          pageSize={PAGE_SIZE}
          onPressItem={(item) => {
            // navigation.navigate("ProductDetail", { id: item.id });
          }}
        />

        {/* SECTION */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Mới Về</Text>
          <TouchableOpacity activeOpacity={0.8}>
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ PRODUCTS: mỗi lượt 4 sp, vuốt ngang qua trang tiếp theo */}
        <ProductPager
          products={PRODUCTS}
          pageSize={PAGE_SIZE}
          onPressItem={(item) => {
            // navigation.navigate("ProductDetail", { id: item.id });
          }}
        />

        {/* SECTION */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Combo gọng + tròng</Text>
          <TouchableOpacity activeOpacity={0.8}>
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ PRODUCTS: mỗi lượt 4 sp, vuốt ngang qua trang tiếp theo */}
        <ProductPager
          products={PRODUCTS}
          pageSize={PAGE_SIZE}
          onPressItem={(item) => {
            // navigation.navigate("ProductDetail", { id: item.id });
          }}
        />
        {/* FOOTER */}
        <HomeFooter
          onChatPress={() => {
            // ví dụ: navigation.navigate("Chat")
          }}
          onCallPress={() => {
            // ví dụ: Linking.openURL("tel:0900000000")
          }}
        />

        {/* spacing bottom */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  // HEADER
  headerWrap: { marginTop: 8, gap: 10 },
  headerRow1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  locationRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "700",
    flexShrink: 1,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E11D48",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  logoutText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  headerRow2: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: "#111827" },

  // ICONS
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartDot: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  cartDotText: { color: "white", fontSize: 11, fontWeight: "800" },

  // CATEGORIES
  catRow: { gap: 16, paddingVertical: 14 },
  catItem: { alignItems: "center", gap: 6 },
  catIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { fontSize: 12, color: "#111827", fontWeight: "700" },

  // CHIPS
  chipRow: { gap: 8, paddingBottom: 6 },
  chip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, color: "#111827", fontWeight: "700" },

  // SECTION
  sectionRow: {
    marginTop: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionLink: { fontSize: 13, fontWeight: "800", color: "#2563EB" },

  // PAGER DOTS
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
