// screens/HomeScreen.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from "react-native-safe-area-context";
// Import đúng cách từ @expo/vector-icons
import { Ionicons, AntDesign, MaterialIcons, FontAwesome5, FontAwesome6, Entypo, MaterialCommunityIcons } from '@expo/vector-icons';

import HeaderSearchActions from "../components/HeaderSearchActions";
import HomeBanner from "../components/HomeBanner";
import HomeFooter from "../components/HomeFooter";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../hooks/useProducts";
import { getMyAddressesApi, setDefaultMyAddressApi } from "../services/userService";
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

// Cập nhật categories với icon từ các thư viện khác nhau
const CATEGORIES = [
  {
    id: "1",
    name: "Gọng kính",
    icon: "glasses",
    iconSet: "FontAwesome5",
    color: "#4F46E5",
    bg: "#EEF2FF"
  },
  {
    id: "2",
    name: "Tròng kính",
    icon: "aperture-outline",
    iconSet: "Ionicons",
    color: "#E11D48",
    bg: "#FFE4E6"
  },
  {
    id: "3",
    name: "Kính mát",
    icon: "glasses",
    iconSet: "Ionicons",
    color: "#F59E0B",
    bg: "#FEF3C7"
  },
  {
    id: "4",
    name: "Phụ kiện",
    icon: "sparkles-sharp",
    iconSet: "Ionicons",
    color: "#10B981",
    bg: "#D1FAE5"
  },
];

// Hàm xác định mùa hiện tại
const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1; // JavaScript months are 0-indexed

  if (month >= 3 && month <= 5) {
    return {
      name: 'Mùa Xuân',
      icon: 'flower',
      iconSet: 'MaterialCommunityIcons',
      color: '#10B981',
      bg: '#D1FAE5',
      subtitle: 'Sản phẩm tươi mới cho mùa xuân'
    };
  } else if (month >= 6 && month <= 8) {
    return {
      name: 'Mùa Hè',
      icon: 'sunny-sharp',
      iconSet: 'Ionicons',
      color: '#F59E0B',
      bg: '#FEF3C7',
      subtitle: 'Chống nắng, chống chói cho mùa hè'
    };
  } else if (month >= 9 && month <= 11) {
    return {
      name: 'Mùa Thu',
      icon: 'canadian-maple-leaf',
      iconSet: 'FontAwesome6',
      color: '#E11D48',
      bg: '#FFE4E6',
      subtitle: 'Phong cách ấm áp cho mùa thu'
    };
  } else {
    return {
      name: 'Mùa Đông',
      icon: 'snowflake',
      iconSet: 'FontAwesome5',
      color: '#4F46E5',
      bg: '#EEF2FF',
      subtitle: 'Giữ ấm đôi mắt mùa đông'
    };
  }
};

// Hàm lọc sản phẩm theo mùa
const getSeasonalProducts = (products, season) => {
  if (!products?.length) return [];

  // Logic lọc sản phẩm theo mùa dựa vào tags hoặc categories
  // Bạn có thể điều chỉnh logic này dựa vào dữ liệu thực tế của bạn
  const seasonalKeywords = {
    'Mùa Xuân': ['xuân', 'spring', 'tết', 'hoa', 'nhẹ', 'pastel'],
    'Mùa Hè': ['hè', 'summer', 'nắng', 'chống nắng', 'kính mát', 'polarized', 'UV'],
    'Mùa Thu': ['thu', 'autumn', 'ấm', 'nâu', 'vintage', 'retro'],
    'Mùa Đông': ['đông', 'winter', 'len', 'gió', 'chống gió', 'chống trầy']
  };

  const keywords = seasonalKeywords[season.name] || [];

  // Lọc sản phẩm dựa vào tên hoặc tags (nếu có)
  // Tạm thời trả về 6 sản phẩm đầu, bạn có thể thay bằng logic thực tế
  // Ví dụ: filter sản phẩm có tags phù hợp với mùa
  const filtered = products.filter(product => {
    // Nếu product có trường seasonalTags
    if (product.seasonalTags) {
      return product.seasonalTags.includes(season.name) ||
        product.seasonalTags.some(tag => keywords.includes(tag.toLowerCase()));
    }
    // Nếu product có category phù hợp với mùa
    if (product.category) {
      if (season.name === 'Mùa Hè' && product.category === 'Kính mát') return true;
      if (season.name === 'Mùa Đông' && product.category === 'Gọng kính') return true;
    }
    return false;
  });

  // Nếu có sản phẩm filter thì trả về, không thì trả về 6 sản phẩm đầu
  return filtered.length > 0 ? filtered.slice(0, 6) : products.slice(0, 6);
};

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ProductPager({ products = [], onPressItem, title }) {
  const pages = useMemo(() => chunkArray(products, 2), [products]);
  const [pageIndex, setPageIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  if (!products?.length) return null;

  return (
    <View style={styles.pagerContainer}>
      <FlatList
        data={pages}
        keyExtractor={(_, idx) => `page-${idx}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pagerContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
          setPageIndex(i);
        }}
        renderItem={({ item: pageItems }) => (
          <View style={[styles.pageContainer, { width: PAGE_W }]}>
            {pageItems.map((p, idx) => (
              <View key={p.id} style={[styles.productCardWrapper, { width: CARD_W }]}>
                <ProductCard
                  item={p}
                  onPress={() => onPressItem?.(p)}
                  index={idx}
                />
              </View>
            ))}
            {pageItems.length === 1 && <View style={{ width: CARD_W }} />}
          </View>
        )}
      />

      {pages.length > 1 && (
        <View style={styles.pagerDots}>
          {pages.map((_, idx) => {
            const inputRange = [
              (idx - 1) * PAGE_W,
              idx * PAGE_W,
              (idx + 1) * PAGE_W,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={idx}
                style={[
                  styles.pagerDot,
                  {
                    width: dotWidth,
                    opacity,
                    backgroundColor: idx === pageIndex ? "#2563EB" : "#D1D5DB",
                  },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

function CategoryCard({ category, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 150,
      friction: 3,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 3,
    }).start();
  };

  // Render icon dựa vào iconSet
  const renderIcon = () => {
    switch (category.iconSet) {
      case "FontAwesome5":
        return <FontAwesome5 name={category.icon} size={24} color={category.color} solid />;
      case "Ionicons":
        return <Ionicons name={category.icon} size={24} color={category.color} />;
      case "MaterialIcons":
        return <MaterialIcons name={category.icon} size={24} color={category.color} />;
      case "AntDesign":
        return <AntDesign name={category.icon} size={24} color={category.color} />;
      case "MaterialCommunityIcons":
        return <MaterialCommunityIcons name={category.icon} size={24} color={category.color} />;
      default:
        return <FontAwesome5 name="box" size={24} color={category.color} />;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[styles.categoryCard, { backgroundColor: category.bg }]}
      >
        {renderIcon()}
        <Text style={[styles.categoryText, { color: category.color }]}>{category.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Component icon cho seasonal section
const SeasonalIcon = ({ season }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const renderIcon = () => {
    switch (season.iconSet) {
      case "FontAwesome5":
        return <FontAwesome5 name={season.icon} size={24} color={season.color} solid />;
      case "Ionicons":
        return <Ionicons name={season.icon} size={24} color={season.color} />;
      case "MaterialCommunityIcons":
        return <MaterialCommunityIcons name={season.icon} size={24} color={season.color} />;
      case "FontAwesome6":
        return <FontAwesome6 name={season.icon} size={24} color={season.color} solid />;
      default:
        return <FontAwesome5 name="leaf" size={24} color={season.color} />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.seasonalIconContainer,
        { backgroundColor: season.bg },
        season.name === 'Mùa Hè' && { transform: [{ rotate: spin }] }
      ]}
    >
      {renderIcon()}
    </Animated.View>
  );
};

export default function HomeScreen({ navigation }) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [query, setQuery] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const { products } = useProducts();
  const [currentSeason, setCurrentSeason] = useState(getCurrentSeason());

  const [settingDefaultId, setSettingDefaultId] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Kiểm tra và cập nhật mùa mỗi khi app mở lại
  useEffect(() => {
    const checkSeasonChange = () => {
      const newSeason = getCurrentSeason();
      if (newSeason.name !== currentSeason.name) {
        // Animation khi đổi mùa
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        setCurrentSeason(newSeason);
      }
    };

    checkSeasonChange();
  }, []);

  const seasonalProducts = useMemo(() =>
    getSeasonalProducts(products, currentSeason),
    [products, currentSeason]
  );

  const loadAddress = useCallback(async () => {
    setAddressLoading(true);
    if (!token) {
      setLocationLabel("");
      setAddresses([]);
      setAddressLoading(false);
      return;
    }

    try {
      const addresses = await getMyAddressesApi();
      const list = Array.isArray(addresses) ? addresses : [];
      setAddresses(list);
    } catch {
      setLocationLabel("");
    } finally {
      setAddressLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadAddress();
    }, [loadAddress])
  );

  useEffect(() => {
    if (!addresses.length) return;
    let preferred = null;
    if (selectedAddressId) {
      preferred = addresses.find((a) => a._id === selectedAddressId);
    }
    if (!preferred) {
      preferred = addresses.find((a) => a.isDefault) || addresses[0];
    }
    if (preferred) {
      const parts = [preferred?.ward, preferred?.district, preferred?.province].filter(Boolean);
      setLocationLabel(parts.join(", ") || preferred?.line1 || "");
      setSelectedAddressId(preferred._id);
    }
  }, [addresses, selectedAddressId]);

  const submitSearch = () => {
    const q = query.trim();
    navigation.navigate("ProductsTab", {
      screen: "Products",
      params: { q },
    });
  };

  const handlePressLocation = () => {
    if (token) {
      loadAddress();
      setAddressModalVisible(true);
    } else {
      navigation.navigate("Login");
    }
  };

  const onSetDefaultAddress = useCallback(
    async (address) => {
      if (!token || !address?._id) return;

      const addressId = address._id;
      if (settingDefaultId) return;

      try {
        setSettingDefaultId(addressId);
        const data = await setDefaultMyAddressApi(addressId);
        const list = Array.isArray(data) ? data : [];

        setAddresses(list);

        const preferred =
          list.find((a) => a?._id === addressId) ||
          list.find((a) => a?.isDefault) ||
          list[0];

        if (preferred) {
          const parts = [preferred?.ward, preferred?.district, preferred?.province].filter(Boolean);
          setLocationLabel(parts.join(", ") || preferred?.line1 || "");
          setSelectedAddressId(preferred._id);
        }

        setAddressModalVisible(false);
      } catch (err) {
        const message =
          err?.response?.data?.message || err?.message || "Không thiết lập lại mặt định được";
        Alert.alert("Address", message);
      } finally {
        setSettingDefaultId(null);
      }
    },
    [token, settingDefaultId]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Location và Auth */}
          <View style={styles.headerWrap}>
            <View style={styles.headerRow1}>
              <TouchableOpacity
                onPress={handlePressLocation}
                style={styles.locationRow}
                activeOpacity={0.85}
              >
                <Ionicons name="location-outline" size={16} color="#111827" />
                <Text style={styles.locationText} numberOfLines={1}>
                  Giao đến: {locationLabel || "Chọn địa chỉ"}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#6B7280" />
              </TouchableOpacity>

              {token ? (
                <TouchableOpacity onPress={logout} style={styles.authBtn}>
                  <Ionicons name="log-out-outline" size={14} color="#fff" />
                  <Text style={styles.authText}>Đăng xuất</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => navigation.navigate("Login")}
                  style={[styles.authBtn, { backgroundColor: "#4F46E5" }]}
                >
                  <Ionicons name="log-in-outline" size={14} color="#fff" />
                  <Text style={styles.authText}>Đăng nhập</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Search */}
            <HeaderSearchActions
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm gọng kính, tròng kính, dịch vụ..."
              onPressFav={() => navigation.navigate("FavTab")}
              onPressCart={() => navigation.navigate("CartFlow", { screen: "Cart" })}
              onSubmit={submitSearch}
            />
          </View>

          {/* Banner */}
          <View style={styles.bannerContainer}>
            <HomeBanner banners={BANNERS} autoPlay intervalMs={3000} />
          </View>

          {/* Categories */}
          <View style={styles.categoriesSection}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Danh mục</Text>
              <TouchableOpacity onPress={() => navigation.navigate("ProductsTab")}>
                <Text style={styles.sectionLink}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScroll}
            >
              {CATEGORIES.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  onPress={() => {
                    // Map category name sang type để lọc
                    let filterType = '';
                    switch (cat.name) {
                      case 'Gọng kính':
                        filterType = 'frame';
                        break;
                      case 'Tròng kính':
                        filterType = 'lens';
                        break;
                      case 'Kính mát':
                        filterType = 'sunglasses';
                        break;
                      case 'Phụ kiện':
                        filterType = 'accessory';
                        break;
                      default:
                        filterType = cat.name.toLowerCase();
                    }

                    // Điều hướng sang ProductsTab và truyền params để lọc
                    navigation.navigate('ProductsTab', {
                      screen: 'Products',
                      params: {
                        category: cat.name,
                        filterType: filterType,
                        autoApplyFilter: true // Flag để biết là cần tự động áp dụng filter
                      }
                    });
                  }}
                />
              ))}
            </ScrollView>
          </View>

          {/* Bán chạy */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}><FontAwesome5 name="fire-alt" size={20} color="red" /> Bán chạy</Text>
              <TouchableOpacity onPress={() => navigation.navigate("ProductsTab")}>
                <Text style={styles.sectionLink}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <ProductPager
              products={products.slice(0, 6)}
              onPressItem={(item) => navigation.navigate("ProductDetail", { item, id: item.apiId })}
            />
          </View>

          {/* Mới về */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}><Entypo name="new" size={20} color="orange" /> Mới về</Text>
              <TouchableOpacity onPress={() => navigation.navigate("ProductsTab")}>
                <Text style={styles.sectionLink}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <ProductPager
              products={products.slice(0, 6)}
              onPressItem={(item) => navigation.navigate("ProductDetail", { item, id: item.apiId })}
            />
          </View>

          {/* Flash Sale */}
          <View style={styles.flashSaleBanner}>
            <View style={styles.flashSaleContent}>
              <View style={styles.flashSaleLeft}>
                <Text style={styles.flashSaleTitle}>FLASH SALE</Text>
                <Text style={styles.flashSaleSubtitle}>Giảm đến 50%</Text>
              </View>
              <TouchableOpacity style={styles.flashSaleBtn}>
                <Text style={styles.flashSaleBtnText}>Mua ngay</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sản phẩm theo mùa - ĐÃ CẬP NHẬT */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <View style={styles.seasonalTitleContainer}>
                <SeasonalIcon season={currentSeason} />
                <View>
                  <Text style={styles.sectionTitle}>
                    {currentSeason.name}
                  </Text>
                  <Text style={styles.seasonalSubtitle}>
                    {currentSeason.subtitle}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("ProductsTab", {
                  screen: "Products",
                  params: {
                    season: currentSeason.name,
                    autoApplyFilter: true
                  }
                })}
              >
                <Text style={styles.sectionLink}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <ProductPager
              products={seasonalProducts}
              onPressItem={(item) => navigation.navigate("ProductDetail", { item, id: item.apiId })}
            />
          </View>

          <View style={{ paddingHorizontal: 20 }} >
            <HomeFooter onChatPress={() => { }} onCallPress={() => { }} />
          </View>
        </ScrollView>
      </Animated.View>

      {/* Address Modal - UI cũ */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Địa chỉ của bạn</Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            {addressLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} />
            ) : addresses.length === 0 ? (
              <Text style={{ marginTop: 20, textAlign: "center" }}>
                Chưa có địa chỉ
              </Text>
            ) : (
              <ScrollView contentContainerStyle={styles.addressList}>
                {addresses.map((a) => {
                  const label =
                    [a?.line1, a?.ward, a?.district, a?.province]
                      .filter(Boolean)
                      .join(", ");
                  const selected = a._id === selectedAddressId;
                  const isSetting = settingDefaultId === a._id;
                  return (
                    <TouchableOpacity
                      key={a._id || label}
                      style={[styles.addressItem]}
                      activeOpacity={0.8}
                      disabled={!!settingDefaultId}
                      onPress={() => onSetDefaultAddress(a)}
                    >
                      {isSetting ? (
                        <ActivityIndicator size="small" style={{ marginRight: 10 }} />
                      ) : (
                        <Ionicons
                          name={selected ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={selected ? "#2563EB" : "#6B7280"}
                          style={{ marginRight: 10 }}
                        />
                      )}

                      <Text style={styles.addressText}>{label}</Text>
                      {a.isDefault && <Text style={styles.defaultBadge}>Mặt định</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7FB"
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 24,
  },

  headerWrap: {
    paddingHorizontal: PAGE_PADDING,
    gap: 10,
    marginBottom: 10,
    paddingBottom: 16,
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
    backgroundColor: "#FFF",
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

  bannerContainer: {
    marginTop: 8,
    marginHorizontal: PAGE_PADDING,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  categoriesSection: {
    marginTop: 20,
    paddingHorizontal: PAGE_PADDING,
  },

  categoriesScroll: {
    paddingVertical: 12,
    gap: 12,
  },

  categoryCard: {
    width: 100,
    height: 100,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },

  categoryText: {
    fontSize: 12,
    fontWeight: "700",
  },

  section: {
    marginTop: 20,
    paddingHorizontal: PAGE_PADDING,
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginLeft: 4,
  },

  sectionLink: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },

  pagerContainer: {
    marginTop: 6,
  },

  pagerContent: {
    paddingVertical: 4,
  },

  pageContainer: {
    flexDirection: "row",
    gap: GAP,
  },

  productCardWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  pagerDots: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },

  pagerDot: {
    height: 8,
    borderRadius: 4,
  },

  flashSaleBanner: {
    marginTop: 20,
    marginHorizontal: PAGE_PADDING,
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#E11D48",
    shadowColor: "#E11D48",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  flashSaleContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  flashSaleLeft: {
    gap: 4,
  },

  flashSaleTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },

  flashSaleSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },

  flashSaleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },

  flashSaleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Seasonal styles
  seasonalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  seasonalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  seasonalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },

  // Modal styles cũ
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  addressList: {
    paddingVertical: 10,
  },
  addressItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  defaultBadge: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
});