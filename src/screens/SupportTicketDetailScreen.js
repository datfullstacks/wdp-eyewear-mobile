import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getSupportTicketByIdApi,
  isWarrantyTicket,
  replySupportTicketApi,
} from "../services/supportService";

function formatTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function getPriorityLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high") return "Uu tien cao";
  if (normalized === "low") return "Uu tien thap";
  return "Binh thuong";
}

function getEligibilityLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "eligible") return "Con bao hanh";
  if (normalized === "expired") return "Het han";
  if (normalized === "not_covered") return "Khong duoc bao hanh";
  return "--";
}

function SectionCard({ title, icon, children, right }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name={icon} size={18} color="#111827" />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "--"}</Text>
    </View>
  );
}

function MetaBadge({ label, fg, bg }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg || "#F3F4F6" }]}>
      <Text style={[styles.badgeText, { color: fg || "#111827" }]}>{label}</Text>
    </View>
  );
}

function MessageBubble({ item }) {
  const isStaff = String(item?.sender || "").toLowerCase() === "staff";
  return (
    <View style={[styles.messageWrap, isStaff ? styles.messageWrapRight : null]}>
      <View
        style={[
          styles.messageBubble,
          isStaff ? styles.messageBubbleStaff : styles.messageBubbleUser,
        ]}
      >
        <Text style={[styles.messageSender, isStaff && styles.messageSenderStaff]}>
          {isStaff ? "Staff" : "Ban"}
        </Text>
        <Text style={[styles.messageText, isStaff && styles.messageTextStaff]}>
          {item?.message || "--"}
        </Text>
        <Text style={[styles.messageTime, isStaff && styles.messageTimeStaff]}>
          {formatTime(item?.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function SupportTicketDetailScreen({ navigation, route }) {
  const ticketId = route?.params?.ticketId || route?.params?.ticket?._id || route?.params?.ticket?.id;
  const seededTicket = route?.params?.ticket || null;

  const [ticket, setTicket] = useState(seededTicket);
  const [loading, setLoading] = useState(!seededTicket);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const loadTicket = useCallback(
    async ({ silent = false } = {}) => {
      if (!ticketId) {
        setError("Thieu ticketId.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!silent) setLoading(true);
      setError("");

      try {
        const nextTicket = await getSupportTicketByIdApi(ticketId);
        setTicket(nextTicket || null);
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Khong tai duoc chi tiet ticket";
        setError(message);
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [ticketId]
  );

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const warranty = useMemo(() => ticket?.warranty || null, [ticket]);
  const warrantyEnabled = isWarrantyTicket(ticket);

  const handleReply = useCallback(async () => {
    const message = String(reply || "").trim();
    if (!message || !ticketId || submitting) return;

    try {
      setSubmitting(true);
      const nextTicket = await replySupportTicketApi(ticketId, { message });
      setTicket(nextTicket || ticket);
      setReply("");
    } catch (err) {
      const messageText =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Khong gui duoc phan hoi";
      Alert.alert("Support", messageText);
    } finally {
      setSubmitting(false);
    }
  }, [reply, submitting, ticketId, ticket]);

  if (loading) {
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
            <Text style={styles.headerTitle}>Chi tiet ho tro</Text>
          </View>
        </View>

        <View style={styles.centerWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.mutedText}>Dang tai ticket...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !ticket) {
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
            <Text style={styles.headerTitle}>Chi tiet ho tro</Text>
          </View>
        </View>

        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={40} color="#9CA3AF" />
          <Text style={styles.errorText}>{error || "Khong tim thay ticket"}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadTicket()}>
            <Text style={styles.retryText}>Thu lai</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>Chi tiet ho tro</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTicket({ silent: true });
            }}
          />
        }
      >
        <SectionCard title={ticket.subject || "Ticket"} icon="chatbubble-ellipses-outline">
          <View style={styles.badgeRow}>
            <MetaBadge
              label={ticket.categoryMeta?.label || ticket.category || "Support"}
              fg={ticket.categoryMeta?.fg}
              bg={ticket.categoryMeta?.bg}
            />
            <MetaBadge
              label={ticket.statusMeta?.label || ticket.status || "open"}
              fg={ticket.statusMeta?.fg}
              bg={ticket.statusMeta?.bg}
            />
            <MetaBadge label={getPriorityLabel(ticket.priority)} fg="#4338CA" bg="#EEF2FF" />
          </View>
          <InfoRow label="Cap nhat" value={formatTime(ticket.lastMessageAt || ticket.updatedAt)} />
          <InfoRow label="Tao luc" value={formatTime(ticket.createdAt)} />
          <InfoRow label="Email" value={ticket.email || "--"} />
        </SectionCard>

        {(ticket.order || ticket.store) && (
          <SectionCard title="Lien ket don hang" icon="receipt-outline">
            <InfoRow label="Ma don" value={ticket.order?.paymentCode || ticket.order?.id || "--"} />
            <InfoRow label="Trang thai don" value={ticket.order?.status || "--"} />
            <InfoRow label="Loai don" value={ticket.order?.orderType || "--"} />
            <InfoRow
              label="Cua hang xu ly"
              value={
                ticket.store?.name
                  ? `${ticket.store.name}${ticket.store.code ? ` (${ticket.store.code})` : ""}`
                  : "--"
              }
            />
            <InfoRow
              label="Khu vuc"
              value={[ticket.store?.district, ticket.store?.city].filter(Boolean).join(", ")}
            />
          </SectionCard>
        )}

        {warrantyEnabled && (
          <SectionCard title="Thong tin bao hanh" icon="shield-checkmark-outline">
            <InfoRow label="Mat hang" value={warranty?.itemName || "--"} />
            <InfoRow label="Tinh trang" value={getEligibilityLabel(warranty?.eligibility)} />
            <InfoRow
              label="Thoi han"
              value={
                warranty?.warrantyMonths
                  ? `${warranty.warrantyMonths} thang`
                  : "Khong co"
              }
            />
            <InfoRow label="Het han" value={formatTime(warranty?.expiresAt)} />
            <InfoRow label="Ghi chu duyet" value={warranty?.decisionNote || "--"} />
            <InfoRow label="Ghi chu bao hanh" value={warranty?.serviceNote || "--"} />
          </SectionCard>
        )}

        <SectionCard
          title="Tin nhan"
          icon="mail-open-outline"
          right={<Text style={styles.subtleMeta}>{ticket.messages?.length || 0} tin</Text>}
        >
          {Array.isArray(ticket.messages) && ticket.messages.length > 0 ? (
            ticket.messages.map((item, index) => (
              <MessageBubble
                key={`${item?.createdAt || "message"}-${index}`}
                item={item}
              />
            ))
          ) : (
            <Text style={styles.mutedText}>Chua co noi dung hoi dap.</Text>
          )}
        </SectionCard>

        <SectionCard title="Phan hoi" icon="create-outline">
          <Text style={styles.mutedText}>
            Gui them thong tin de staff tiep tuc xu ly case nay.
          </Text>
          <TextInput
            style={styles.replyInput}
            placeholder="Nhap noi dung phan hoi..."
            multiline
            textAlignVertical="top"
            value={reply}
            onChangeText={setReply}
          />
          <TouchableOpacity
            style={[styles.submitBtn, (!String(reply || "").trim() || submitting) && styles.submitBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleReply}
            disabled={!String(reply || "").trim() || submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? "Dang gui..." : "Gui phan hoi"}
            </Text>
          </TouchableOpacity>
        </SectionCard>
      </ScrollView>
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  mutedText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
  },
  retryText: {
    color: "#2563EB",
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#111827",
  },
  subtleMeta: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: "900",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  infoLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B7280",
  },
  infoValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#111827",
    textAlign: "right",
  },
  messageWrap: {
    marginTop: 10,
    alignItems: "flex-start",
  },
  messageWrapRight: {
    alignItems: "flex-end",
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageBubbleUser: {
    backgroundColor: "#F3F4F6",
  },
  messageBubbleStaff: {
    backgroundColor: "#111827",
  },
  messageSender: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#2563EB",
  },
  messageSenderStaff: {
    color: "#93C5FD",
  },
  messageText: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 18,
  },
  messageTextStaff: {
    color: "#FFFFFF",
  },
  messageTime: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  messageTimeStaff: {
    color: "#CBD5E1",
  },
  replyInput: {
    minHeight: 110,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  submitBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
