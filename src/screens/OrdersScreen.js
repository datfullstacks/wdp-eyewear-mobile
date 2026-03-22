import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { getMyOrdersApi, cancelOrderApi } from "../services/orderService";
import OrderCard from "../components/OrderCard";

const STATUS_FILTERS = [
  { key: "all", label: "Tất cả", icon: "apps-outline" },
  { key: "pending", label: "Chờ xác nhận", icon: "time-outline", color: "#B45309" },
  { key: "confirmed", label: "Đã xác nhận", icon: "checkmark-circle-outline", color: "#1D4ED8" },
  { key: "processing", label: "Đang xử lý", icon: "sync-outline", color: "#1D4ED8" },
  { key: "shipped", label: "Đang giao", icon: "bicycle-outline", color: "#0F766E" },
  { key: "delivered", label: "Đã giao", icon: "checkmark-done-outline", color: "#15803D" },
  { key: "cancelled", label: "Đã hủy", icon: "close-circle-outline", color: "#991B1B" },
];

const ORDER_TYPE_FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "order", label: "Order" },
  { key: "preorder", label: "Pre-order" },
];

const SORT_OPTIONS = [
  {
    key: "newest",
    label: "Mới nhất",
    icon: "arrow-up",
    iconSet: "FontAwesome5",
  },
  {
    key: "oldest",
    label: "Cũ nhất",
    icon: "arrow-down",
    iconSet: "FontAwesome5",
  },
  {
    key: "price_asc",
    label: "Giá thấp đến cao",
    icon: "arrow-up",
    iconSet: "FontAwesome5",
  },
  {
    key: "price_desc",
    label: "Giá cao đến thấp",
    icon: "arrow-down",
    iconSet: "FontAwesome5",
  },
];

const normalizeFilterArray = (value) => {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item).toLowerCase().trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : ["all"];
  }

  if (!value) return ["all"];
  return [String(value).toLowerCase().trim()];
};

const isFilterSelected = (filters, key) => {
  return normalizeFilterArray(filters).includes(String(key).toLowerCase());
};

const toggleFilter = (prevFilters, key) => {
  const normalizedKey = String(key).toLowerCase();
  const current = normalizeFilterArray(prevFilters).filter((item) => item !== "all");

  if (normalizedKey === "all") {
    return ["all"];
  }

  let next;
  if (current.includes(normalizedKey)) {
    next = current.filter((item) => item !== normalizedKey);
  } else {
    next = [...current, normalizedKey];
  }

  return next.length ? next : ["all"];
};

export default function OrdersScreen({ navigation, route }) {
  const initialFilter = route?.params?.initialFilter || ["all"];

  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState(
    Array.isArray(initialFilter) ? initialFilter : [initialFilter]
  );
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [activeOrderTypeFilter, setActiveOrderTypeFilter] = useState("all");

  useEffect(() => {
    setActiveFilter(Array.isArray(initialFilter) ? initialFilter : [initialFilter]);
  }, [initialFilter]);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const result = await getMyOrdersApi(
        { page: 1, limit: 1000 },
        { enrichProducts: true, includeItems: true, detailLevel: "summary" }
      );
      const ordersData = Array.isArray(result?.items) ? result.items : [];
      setOrders(ordersData);
    } catch (err) {
      const data = err?.response?.data || {};
      setError(
        data.message || data.error || err?.message || "Không tải được đơn hàng"
      );
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let filtered = [...orders];
    const selectedFilters = normalizeFilterArray(activeFilter);

    if (activeOrderTypeFilter !== "all") {
      filtered = filtered.filter((order) => {
        const hasPreorder =
          Boolean(order?.preOrder ?? order?.preorder) ||
          String(order?.orderType || "").toUpperCase() === "PREORDER" ||
          (Array.isArray(order?.items) &&
            order.items.some((item) => Boolean(item?.preOrder ?? item?.preorder)));

        return activeOrderTypeFilter === "preorder" ? hasPreorder : !hasPreorder;
      });
    }

    if (!selectedFilters.includes("all")) {
      filtered = filtered.filter((order) => {
        const status = String(order?.status || "").toLowerCase();
        return selectedFilters.includes(status);
      });
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a?.createdAt || 0).getTime();
      const dateB = new Date(b?.createdAt || 0).getTime();
      const totalA = Number(a?.total || 0);
      const totalB = Number(b?.total || 0);

      switch (sortBy) {
        case "newest":
          return dateB - dateA;
        case "oldest":
          return dateA - dateB;
        case "price_asc":
          return totalA - totalB;
        case "price_desc":
          return totalB - totalA;
        default:
          return dateB - dateA;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, activeFilter, sortBy, activeOrderTypeFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const emptyComponent = useMemo(() => {
    const selectedFilters = normalizeFilterArray(activeFilter);

    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.emptySub}>Đang tải đơn hàng...</Text>
        </View>
      );
    }

    if (!selectedFilters.includes("all") && filteredOrders.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="filter-outline" size={44} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>Không có đơn hàng</Text>
          <Text style={styles.emptySub}>
            Không tìm thấy đơn hàng theo bộ lọc hiện tại
          </Text>
          <TouchableOpacity
            style={styles.clearFilterBtn}
            onPress={() => setActiveFilter(["all"])}
          >
            <Text style={styles.clearFilterText}>Xem tất cả đơn hàng</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="receipt-outline" size={44} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Chưa có đơn hàng</Text>
        <Text style={styles.emptySub}>
          Đơn hàng sẽ hiển thị ở đây sau khi thanh toán.
        </Text>
      </View>
    );
  }, [loading, activeFilter, filteredOrders.length]);

  const handleCancelOrder = useCallback(
    (order) => {
      const orderId = order?._id || order?.id || null;
      if (!orderId) {
        Alert.alert("Không thể huỷ", "Thiếu orderId.");
        return;
      }

      Alert.alert(
        "Huỷ đơn hàng?",
        "Bạn chắc chắn muốn huỷ đơn này? Thao tác không thể hoàn tác.",
        [
          { text: "Không", style: "cancel" },
          {
            text: "Huỷ đơn",
            style: "destructive",
            onPress: async () => {
              try {
                await cancelOrderApi(orderId);
                await loadOrders({ silent: true });
                Alert.alert("Thành công", "Đã huỷ đơn hàng.");
              } catch (err) {
                const data = err?.response?.data || {};
                Alert.alert(
                  "Huỷ thất bại",
                  data?.message ||
                    data?.error ||
                    err?.message ||
                    "Không thể huỷ đơn."
                );
              }
            },
          },
        ]
      );
    },
    [loadOrders]
  );

  const getOrderCountByStatus = (statusKey) => {
    if (statusKey === "all") return orders.length;

    return orders.filter(
      (order) => String(order?.status || "").toLowerCase() === statusKey
    ).length;
  };

  const getSortButtonLabel = () => {
    switch (sortBy) {
      case "newest":
        return "Mới";
      case "oldest":
        return "Cũ";
      case "price_asc":
        return "Giá ↑";
      case "price_desc":
        return "Giá ↓";
      default:
        return "Mới";
    }
  };

  const renderSortIcon = (option) => {
    const color = sortBy === option.key ? "#2563EB" : "#6B7280";
    const size = 14;
    return <FontAwesome5 name={option.icon} size={size} color={color} />;
  };

  const selectedFilters = normalizeFilterArray(activeFilter);

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
          <Text style={styles.headerTitle}>Đơn hàng</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.sortBtn, showSortDropdown && styles.sortBtnActive]}
            onPress={() => {
              setShowSortDropdown(!showSortDropdown);
              setShowFilterDropdown(false);
            }}
            activeOpacity={0.7}
          >
            <FontAwesome5
              name="sort-amount-down"
              size={14}
              color={showSortDropdown ? "#2563EB" : "#6B7280"}
            />
            <Text
              style={[
                styles.sortBtnText,
                showSortDropdown && styles.sortBtnTextActive,
              ]}
            >
              {getSortButtonLabel()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              showFilterDropdown && styles.filterBtnActive,
            ]}
            onPress={() => {
              setShowFilterDropdown(!showFilterDropdown);
              setShowSortDropdown(false);
            }}
            activeOpacity={0.7}
          >
            <FontAwesome5
              name="filter"
              size={14}
              color={showFilterDropdown ? "#2563EB" : "#6B7280"}
            />
            {!selectedFilters.includes("all") && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {showSortDropdown && (
        <View style={styles.sortDropdown}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sortDropdownContent}
          >
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  sortBy === option.key && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortBy(option.key);
                  setShowSortDropdown(false);
                }}
              >
                <View style={styles.sortOptionLeft}>
                  {renderSortIcon(option)}
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortBy === option.key && styles.sortOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>
                {sortBy === option.key && (
                  <Ionicons name="checkmark" size={16} color="#2563EB" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showFilterDropdown && (
        <View style={styles.filterDropdown}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {STATUS_FILTERS.map((filter) => {
              const count = getOrderCountByStatus(filter.key);
              const isActive = isFilterSelected(activeFilter, filter.key);

              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setActiveFilter((prev) => toggleFilter(prev, filter.key));
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={filter.icon}
                    size={14}
                    color={isActive ? "#2563EB" : filter.color || "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                  {count > 0 && (
                    <View style={styles.filterChipBadge}>
                      <Text style={styles.filterChipBadgeText}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!selectedFilters.includes("all") &&
        !showFilterDropdown &&
        !showSortDropdown && (
          <View style={styles.activeFilterBar}>
            <View style={styles.activeFilterLeft}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeFilterScrollContent}
              >
                <View style={styles.activeFilterTags}>
                  {selectedFilters.map((filterKey) => {
                    const filterObj = STATUS_FILTERS.find((f) => f.key === filterKey);
                    if (!filterObj) return null;

                    return (
                      <View key={filterKey} style={styles.activeFilterTag}>
                        <Ionicons
                          name={filterObj.icon}
                          size={12}
                          color={filterObj.color || "#2563EB"}
                        />
                        <Text style={styles.activeFilterText}>
                          {filterObj.label}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            setActiveFilter((prev) => toggleFilter(prev, filterKey))
                          }
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={14}
                            color="#9CA3AF"
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <Text style={styles.activeFilterCount}>
              {filteredOrders.length} đơn
            </Text>
          </View>
        )}

      <View style={styles.orderTypeFilterWrap}>
        {ORDER_TYPE_FILTERS.map((filter) => {
          const isActive = activeOrderTypeFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.orderTypeChip,
                isActive && styles.orderTypeChipActive,
              ]}
              activeOpacity={0.7}
              onPress={() => setActiveOrderTypeFilter(filter.key)}
            >
              <Text
                style={[
                  styles.orderTypeChipText,
                  isActive && styles.orderTypeChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => loadOrders()}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => String(item?._id || item?.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onCancel={handleCancelOrder}
            onPress={() => {
              navigation.navigate("OrderDetail", {
                orderId: item?._id || item?.id,
              });
            }}
          />
        )}
        ListEmptyComponent={emptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrders({ silent: true });
            }}
          />
        }
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

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },

  sortBtnActive: {
    backgroundColor: "#EFF6FF",
  },

  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  sortBtnTextActive: {
    color: "#2563EB",
  },

  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },

  filterBtnActive: {
    backgroundColor: "#EFF6FF",
  },

  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  sortDropdown: {
    position: "absolute",
    top: 60,
    right: 60,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
    minWidth: 200,
    maxHeight: 300,
  },

  sortDropdownContent: {
    gap: 4,
  },

  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },

  sortOptionActive: {
    backgroundColor: "#EFF6FF",
  },

  sortOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  sortOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },

  sortOptionTextActive: {
    color: "#2563EB",
  },

  filterDropdown: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },

  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },

  filterChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  filterChipTextActive: {
    color: "#2563EB",
  },

  filterChipBadge: {
    marginLeft: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 12,
  },

  filterChipBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },

  orderTypeFilterWrap: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 4,
    gap: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },

  orderTypeChip: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "transparent",
  },

  orderTypeChipActive: {
    backgroundColor: "#FFFFFF",
  },

  orderTypeChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },

  orderTypeChipTextActive: {
    color: "#2563EB",
  },

  activeFilterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  activeFilterLeft: {
    flex: 1,
    minWidth: 0,
  },

  activeFilterScrollContent: {
    paddingRight: 8,
  },

  activeFilterTags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  activeFilterTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },

  activeFilterText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563EB",
  },

  activeFilterCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  errorText: {
    flex: 1,
    color: "#991B1B",
    fontWeight: "700",
    fontSize: 12.5,
  },

  retryText: {
    color: "#1D4ED8",
    fontWeight: "900",
    fontSize: 12.5,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },

  emptyWrap: {
    paddingTop: 48,
    alignItems: "center",
    gap: 8,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },

  emptySub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },

  emptyIconContainer: {
    marginBottom: 8,
  },

  clearFilterBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
  },

  clearFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
});
