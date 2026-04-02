import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  createSupportTicketApi,
  getSupportTicketsApi,
  isSupportTicketUnread,
  SUPPORT_CATEGORY_META,
} from "../services/supportService";
import { useSupportInboxStore } from "../store/supportInboxStore";

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

const CATEGORY_OPTIONS = [
  { key: "general", label: "Chung" },
  { key: "order", label: "Đơn hàng" },
  { key: "refund", label: "Hoàn tiền" },
  { key: "warranty", label: "Bảo hành" },
];

const FILTER_OPTIONS = [
  { key: "all", label: "Tất cả" },
  { key: "general", label: "Chung" },
  { key: "order", label: "Đơn hàng" },
  { key: "refund", label: "Hoàn tiền" },
  { key: "warranty", label: "Bảo hành" },
];

const PRIORITY_OPTIONS = [
  { key: "normal", label: "Bình thường" },
  { key: "high", label: "Ưu tiên cao" },
  { key: "low", label: "Ưu tiên thấp" },
];

function formatTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function buildDefaultSubject({ category, orderCode, orderItemName }) {
  if (category === "warranty") {
    return orderItemName
      ? `Bảo hành: ${orderItemName}`
      : orderCode
        ? `Bảo hành đơn ${orderCode}`
        : "Yêu cầu bảo hành";
  }

  if (category === "order" && orderCode) {
    return `Hỗ trợ đơn ${orderCode}`;
  }

  if (category === "refund" && orderCode) {
    return `Hỏi đáp hoàn tiền đơn ${orderCode}`;
  }

  return "";
}

function TicketCard({ item, onPress, showUnread }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={() => onPress(item)}>
      <View style={styles.cardTop}>
        <Text style={styles.subject} numberOfLines={2}>
          {item?.subject || "--"}
        </Text>
        <View style={styles.cardTopRight}>
          {showUnread ? <View style={styles.unreadDot} /> : null}
          <View style={styles.metaBadges}>
            <View
              style={[
                styles.metaBadge,
                { backgroundColor: item?.categoryMeta?.bg || PALETTE.navyTint },
              ]}
            >
              <Text
                style={[
                  styles.metaBadgeText,
                  { color: item?.categoryMeta?.fg || PALETTE.navy },
                ]}
              >
                {item?.categoryMeta?.label || item?.category || "Support"}
              </Text>
            </View>
            <View
              style={[
                styles.metaBadge,
                { backgroundColor: item?.statusMeta?.bg || PALETTE.border },
              ]}
            >
              <Text
                style={[
                  styles.metaBadgeText,
                  { color: item?.statusMeta?.fg || PALETTE.text },
                ]}
              >
                {item?.statusMeta?.label || item?.status || "open"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {!!item?.latestMessage ? (
        <Text style={styles.message} numberOfLines={2}>
          {item.latestMessage}
        </Text>
      ) : null}

      {item?.warranty ? (
        <Text style={styles.secondaryText}>
          Bảo hành: {item.warranty.itemName || "--"} - {item.warranty.eligibility || "--"}
        </Text>
      ) : null}

      {item?.order?.paymentCode ? (
        <Text style={styles.secondaryText}>Đơn: {item.order.paymentCode}</Text>
      ) : null}

      {item?.store?.name ? (
        <Text style={styles.secondaryText}>
          Cửa hàng: {item.store.name}
          {item.store.code ? ` (${item.store.code})` : ""}
        </Text>
      ) : null}

      <View style={styles.cardBottom}>
        <Text style={styles.time}>Cập nhật: {formatTime(item?.lastMessageAt || item?.updatedAt)}</Text>
        <Ionicons name="chevron-forward" size={18} color={PALETTE.muted} />
      </View>
    </TouchableOpacity>
  );
}

export default function SupportScreen({ navigation, route }) {
  const seenByTicketId = useSupportInboxStore((s) => s.seenByTicketId);
  const refreshSupportUnread = useSupportInboxStore((s) => s.refreshUnreadFromApi);
  const prefillCategory = String(route?.params?.prefillCategory || "general")
    .trim()
    .toLowerCase();
  const prefillOrderId = String(route?.params?.orderId || "").trim();
  const prefillOrderCode = String(route?.params?.orderCode || "").trim();
  const prefillOrderItemId = String(route?.params?.orderItemId || "").trim();
  const prefillOrderItemName = String(route?.params?.orderItemName || "").trim();
  const draftSubject = String(route?.params?.draftSubject || "").trim();
  const lockCategory = Boolean(route?.params?.lockCategory);

  const initialCategory = CATEGORY_OPTIONS.some((item) => item.key === prefillCategory)
    ? prefillCategory
    : "general";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState(
    initialCategory === "warranty" ? "warranty" : "all"
  );
  const [category, setCategory] = useState(initialCategory);
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState(
    draftSubject ||
      buildDefaultSubject({
        category: initialCategory,
        orderCode: prefillOrderCode,
        orderItemName: prefillOrderItemName,
      })
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCategory(initialCategory);
    setActiveFilter(initialCategory === "warranty" ? "warranty" : "all");
    setSubject(
      draftSubject ||
        buildDefaultSubject({
          category: initialCategory,
          orderCode: prefillOrderCode,
          orderItemName: prefillOrderItemName,
        })
    );
    setMessage("");
  }, [
    draftSubject,
    initialCategory,
    prefillOrderCode,
    prefillOrderItemName,
    prefillOrderId,
    prefillOrderItemId,
  ]);

  const selectedCategoryMeta = SUPPORT_CATEGORY_META[category] || SUPPORT_CATEGORY_META.general;
  const hasOrderContext = Boolean(prefillOrderId);
  const isWarrantyDraft = category === "warranty" && hasOrderContext && prefillOrderItemId;

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const params = { page: 1, limit: 50 };
        if (activeFilter !== "all") {
          params.category = activeFilter;
        }
        const result = await getSupportTicketsApi(params);
        const nextItems = Array.isArray(result?.items) ? result.items : [];
        setItems(nextItems);
        void refreshSupportUnread().catch(() => {});
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Không tải được phiếu hỗ trợ";
        Alert.alert("Hỗ trợ", msg);
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilter, refreshSupportUnread]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onCreate = async () => {
    if (submitting) return;

    const nextSubject = String(subject || "").trim();
    const nextMessage = String(message || "").trim();

    if (!nextSubject || !nextMessage) {
      Alert.alert("Hỗ trợ", "Tiêu đề và nội dung là bắt buộc.");
      return;
    }

    if (category === "warranty" && (!prefillOrderId || !prefillOrderItemId)) {
      Alert.alert(
        "Bảo hành",
        "Bảo hành phải được tạo từ một mặt hàng đã giao trong chi tiết đơn."
      );
      return;
    }

    try {
      setSubmitting(true);
      const created = await createSupportTicketApi({
        subject: nextSubject,
        message: nextMessage,
        category,
        priority,
        ...(prefillOrderId ? { orderId: prefillOrderId } : {}),
        ...(category === "warranty" && prefillOrderItemId
          ? { orderItemId: prefillOrderItemId }
          : {}),
      });

      setMessage("");
      if (!lockCategory) {
        setCategory("general");
        setSubject("");
      }

      await loadData({ silent: true });

      if (created?.id || created?._id) {
        navigation.navigate("SupportTicketDetail", {
          ticketId: created.id || created._id,
          ticket: created,
        });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Không tạo được phiếu hỗ trợ";
      Alert.alert("Hỗ trợ", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item?.category === activeFilter);
  }, [activeFilter, items]);

  const emptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="small" color={PALETTE.navy} />
          <Text style={styles.emptyText}>Đang tải yêu cầu...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="chatbubble-ellipses-outline" size={42} color={PALETTE.muted} />
        <Text style={styles.emptyTitle}>Chưa có yêu cầu hỗ trợ</Text>
        <Text style={styles.emptyText}>Yêu cầu mới sẽ hiện ở đây sau khi gửi.</Text>
      </View>
    );
  }, [loading]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : null)}
            activeOpacity={0.85}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hỗ trợ & bảo hành</Text>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item?.id || item?._id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.formCard}>
              <View style={styles.formHeading}>
                <View>
                  <Text style={styles.formTitle}>Tạo yêu cầu hỗ trợ mới</Text>
                  <Text style={styles.formSubTitle}>
                    Gửi yêu cầu cho đơn hàng, hoàn tiền, hoặc bảo hành cho nhân viên.
                  </Text>
                </View>
              </View>

              {hasOrderContext ? (
                <View style={styles.contextCard}>
                  <Text style={styles.contextTitle}>Liên kết đơn hàng</Text>
                  <Text style={styles.contextText}>Mã đơn: {prefillOrderCode || prefillOrderId}</Text>
                  {prefillOrderItemName ? (
                    <Text style={styles.contextText}>Mặt hàng: {prefillOrderItemName}</Text>
                  ) : null}
                  <Text style={styles.contextHint}>
                    {isWarrantyDraft
                      ? "Yêu cầu này sẽ được tạo dưới loại Bảo hành và gắn với sản phẩm đã chọn."
                      : "Yêu cầu này sẽ được gắn với đơn hàng hiện tại."}
                  </Text>
                </View>
              ) : null}

              {!lockCategory ? (
                <View style={styles.optionGroup}>
                  <Text style={styles.optionLabel}>Loại yêu cầu</Text>
                  <View style={styles.optionRow}>
                    {CATEGORY_OPTIONS.map((option) => {
                      const active = category === option.key;
                      return (
                        <TouchableOpacity
                          key={option.key}
                          style={[styles.optionChip, active && styles.optionChipActive]}
                          activeOpacity={0.85}
                          onPress={() => {
                            setCategory(option.key);
                            if (!subject.trim()) {
                              setSubject(
                                buildDefaultSubject({
                                  category: option.key,
                                  orderCode: prefillOrderCode,
                                  orderItemName: prefillOrderItemName,
                                })
                              );
                            }
                          }}
                        >
                          <Text
                            style={[styles.optionChipText, active && styles.optionChipTextActive]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.optionGroup}>
                <Text style={styles.optionLabel}>Mức ưu tiên</Text>
                <View style={styles.optionRow}>
                  {PRIORITY_OPTIONS.map((option) => {
                    const active = priority === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.optionChip, active && styles.optionChipActive]}
                        activeOpacity={0.85}
                        onPress={() => setPriority(option.key)}
                      >
                        <Text
                          style={[styles.optionChipText, active && styles.optionChipTextActive]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Tiêu đề"
                placeholderTextColor={PALETTE.muted}
                value={subject}
                onChangeText={setSubject}
              />
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder={
                  isWarrantyDraft
                    ? "Mô tả lỗi, tình trạng sản phẩm, và nhu cầu bảo hành..."
                    : "Mô tả vấn đề cần nhân viên hỗ trợ..."
                }
                placeholderTextColor={PALETTE.muted}
                multiline
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
              />
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={onCreate}
                disabled={submitting}
              >
                <Text style={styles.submitText}>
                  {submitting ? "Đang gửi..." : "Tạo yêu cầu hỗ trợ"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterWrap}>
              {FILTER_OPTIONS.map((option) => {
                const active = activeFilter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    activeOpacity={0.85}
                    onPress={() => setActiveFilter(option.key)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TicketCard
            item={item}
            showUnread={isSupportTicketUnread(
              item,
              seenByTicketId[String(item?.id || item?._id || "").trim()] || null,
            )}
            onPress={(selected) =>
              navigation.navigate("SupportTicketDetail", {
                ticketId: selected?.id || selected?._id,
                ticket: selected,
              })
            }
          />
        )}
        ListEmptyComponent={emptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData({ silent: true });
            }}
          />
        }
      />
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
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: PALETTE.text },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  formCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginBottom: 14,
  },
  formHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  formTitle: { fontSize: 14, fontWeight: "900", color: PALETTE.text },
  formSubTitle: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  contextCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: PALETTE.navyTint,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  contextTitle: { fontSize: 12.5, fontWeight: "900", color: PALETTE.text },
  contextText: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.text,
  },
  contextHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 17,
  },
  optionGroup: { marginBottom: 10 },
  optionLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "900",
    color: PALETTE.text,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  optionChipActive: {
    backgroundColor: PALETTE.navyTint,
    borderColor: PALETTE.navy,
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  optionChipTextActive: {
    color: PALETTE.navy,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.text,
    backgroundColor: PALETTE.white,
    marginBottom: 8,
  },
  inputMulti: {
    height: 108,
    paddingTop: 12,
    paddingBottom: 12,
  },
  submitBtn: {
    marginTop: 4,
    height: 44,
    borderRadius: 12,
    backgroundColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: PALETTE.white, fontWeight: "900", fontSize: 13 },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  filterChipActive: {
    backgroundColor: PALETTE.navy,
    borderColor: PALETTE.navy,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  filterChipTextActive: {
    color: PALETTE.white,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTopRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  subject: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "900",
    color: PALETTE.text,
    lineHeight: 19,
  },
  metaBadges: {
    alignItems: "flex-end",
    gap: 6,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: PALETTE.white,
  },
  metaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaBadgeText: {
    fontSize: 11.5,
    fontWeight: "900",
  },
  message: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
    lineHeight: 18,
  },
  secondaryText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  cardBottom: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  time: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  emptyWrap: {
    paddingTop: 44,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: PALETTE.text,
  },
  emptyText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: PALETTE.muted,
    textAlign: "center",
  },
});
