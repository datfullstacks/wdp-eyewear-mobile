import React, { useCallback, useEffect, useState } from "react";
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
import SupportAttachmentSection from "../components/SupportAttachmentSection";
import {
  getSupportTicketByIdApi,
  isWarrantyTicket,
  replySupportTicketApi,
} from "../services/supportService";
import {
  buildSupportAttachmentPayload,
  pickAndUploadSupportAttachmentAsync,
  SUPPORT_ATTACHMENT_MAX_ITEMS,
} from "../services/supportMediaService";

const PALETTE = {
  navy: "#0c2c5c",
  navySoft: "#17365D",
  navyTint: "#EEF3F8",
  bg: "#F6F7FB",
  white: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#EEF2F7",
  blue: "#2563EB",
};

function formatTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function getEligibilityLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "eligible") return "Còn bảo hành";
  if (normalized === "expired") return "Hết hạn";
  if (normalized === "not_covered") return "Không được bảo hành";
  return "--";
}

function getWarrantyOrderStatusLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "created") return "Đã tạo đơn bảo hành";
  if (normalized === "in_service") return "Đang xử lý bảo hành";
  if (normalized === "completed") return "Đã hoàn tất bảo hành";
  if (normalized === "cancelled") return "Đã hủy đơn bảo hành";
  return "--";
}

function SectionCard({ title, icon, children, right }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name={icon} size={18} color={PALETTE.text} />
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
      <Text style={[styles.badgeText, { color: fg || PALETTE.text }]}>{label}</Text>
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
          {isStaff ? "Staff" : "Bạn"}
        </Text>
        <Text style={[styles.messageText, isStaff && styles.messageTextStaff]}>
          {item?.message || "--"}
        </Text>
        {Array.isArray(item?.attachments) && item.attachments.length > 0 ? (
          <SupportAttachmentSection attachments={item.attachments} compact emptyText="" />
        ) : null}
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
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [uploadingReplyAttachments, setUploadingReplyAttachments] = useState(false);
  const [error, setError] = useState("");

  const loadTicket = useCallback(
    async ({ silent = false } = {}) => {
      if (!ticketId) {
        setError("Thiếu ticketId.");
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
        setError(err?.response?.data?.message || err?.message || "Không tải được chi tiết yêu cầu.");
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [ticketId]
  );

  useEffect(() => { loadTicket(); }, [loadTicket]);

  const warrantyEnabled = isWarrantyTicket(ticket);
  const warranty = ticket?.warranty || null;

  const handleAddReplyAttachment = useCallback(async () => {
    if (
      uploadingReplyAttachments ||
      replyAttachments.length >= SUPPORT_ATTACHMENT_MAX_ITEMS
    ) {
      return;
    }

    try {
      setUploadingReplyAttachments(true);
      const uploaded = await pickAndUploadSupportAttachmentAsync({
        folder: "support-replies",
      });
      if (!uploaded) return;

      setReplyAttachments((prev) => {
        const next = [...prev, uploaded];
        return next.slice(0, SUPPORT_ATTACHMENT_MAX_ITEMS);
      });
    } catch (err) {
      Alert.alert(
        "Hỗ trợ",
        err?.message || "Không thể tải ảnh hoặc video lên.",
      );
    } finally {
      setUploadingReplyAttachments(false);
    }
  }, [replyAttachments.length, uploadingReplyAttachments]);

  const handleRemoveReplyAttachment = useCallback((attachment) => {
    setReplyAttachments((prev) =>
      prev.filter((item) => item?.url !== attachment?.url),
    );
  }, []);

  const handleReply = useCallback(async () => {
    const message = String(reply || "").trim();
    if (!message || !ticketId || submitting) return;
    try {
      setSubmitting(true);
      const nextTicket = await replySupportTicketApi(ticketId, {
        message,
        attachments: replyAttachments
          .map(buildSupportAttachmentPayload)
          .filter(Boolean),
      });
      setTicket(nextTicket || ticket);
      setReply("");
      setReplyAttachments([]);
    } catch (err) {
      Alert.alert("Hỗ trợ", err?.message || "Không gửi được phản hồi");
    } finally {
      setSubmitting(false);
    }
  }, [reply, replyAttachments, submitting, ticketId, ticket]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chi tiết hỗ trợ</Text>
          </View>
        </View>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="small" color={PALETTE.navy} />
          <Text style={styles.mutedText}>Đang tải yêu cầu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !ticket) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chi tiết hỗ trợ</Text>
          </View>
        </View>
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={PALETTE.muted} />
          <Text style={styles.errorText}>{error || "Không tìm thấy yêu cầu"}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadTicket()}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết hỗ trợ</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTicket({ silent: true }); }} />}
      >
        <SectionCard title={ticket.subject || "Ticket"} icon="chatbubble-ellipses-outline">
          <View style={styles.badgeRow}>
            <MetaBadge
              label={ticket.statusMeta?.label || ticket.status || "Open"}
              fg={ticket.statusMeta?.fg || PALETTE.navy}
              bg={ticket.statusMeta?.bg || PALETTE.navyTint}
            />
          </View>
          <InfoRow label="Cập nhật" value={formatTime(ticket.lastMessageAt || ticket.updatedAt)} />
          <InfoRow label="Email" value={ticket.email || "--"} />
        </SectionCard>

        {ticket.order && (
          <SectionCard title="Liên kết đơn hàng" icon="receipt-outline">
            <InfoRow label="Mã đơn" value={ticket.order?.paymentCode || ticket.order?.id || "--"} />
            <InfoRow label="Trạng thái" value={ticket.order?.status || "--"} />
          </SectionCard>
        )}

        {warrantyEnabled && (
          <SectionCard title="Thông tin bảo hành" icon="shield-checkmark-outline">
            <InfoRow label="Mặt hàng" value={warranty?.itemName || "--"} />
            <InfoRow label="Tình trạng" value={getEligibilityLabel(warranty?.eligibility)} />
            <InfoRow label="Thời hạn" value={warranty?.warrantyMonths ? `${warranty.warrantyMonths} tháng` : "Không có"} />
            <InfoRow
              label="Quy trình"
              value={
                warranty?.serviceOrder?.code
                  ? "Sale đã xác nhận và tạo đơn bảo hành cho case này."
                  : "Khách cần gửi ảnh hoặc video hiện trạng để sale xác nhận trước khi tạo đơn bảo hành."
              }
            />
            {warranty?.serviceOrder?.code ? (
              <>
                <InfoRow label="Đơn bảo hành" value={warranty.serviceOrder.code} />
                <InfoRow
                  label="Trạng thái đơn"
                  value={getWarrantyOrderStatusLabel(warranty.serviceOrder.status)}
                />
                <InfoRow
                  label="Tạo lúc"
                  value={formatTime(warranty.serviceOrder.createdAt)}
                />
                {warranty?.serviceOrder?.note ? (
                  <InfoRow
                    label="Ghi chú đơn"
                    value={warranty.serviceOrder.note}
                  />
                ) : null}
              </>
            ) : null}
          </SectionCard>
        )}

        <SectionCard
          title="Hội thoại"
          icon="mail-open-outline"
          right={<Text style={styles.subtleMeta}>{ticket.messages?.length || 0} tin nhắn</Text>}
        >
          {Array.isArray(ticket.messages) && ticket.messages.length > 0 ? (
            ticket.messages.map((item, index) => (
              <MessageBubble key={index} item={item} />
            ))
          ) : (
            <Text style={styles.mutedText}>Chưa có nội dung hỏi đáp.</Text>
          )}
        </SectionCard>

        <SectionCard title="Phản hồi" icon="create-outline">
          <TextInput
            style={styles.replyInput}
            placeholder="Nhập nội dung phản hồi cho nhân viên..."
            multiline
            textAlignVertical="top"
            value={reply}
            onChangeText={setReply}
          />
          <SupportAttachmentSection
            title="Bằng chứng bổ sung"
            helperText="Bạn có thể gửi thêm ảnh hoặc video để bổ sung bằng chứng cho yêu cầu này."
            emptyText="Chưa có ảnh hoặc video nào được chọn."
            attachments={replyAttachments}
            editable
            uploading={uploadingReplyAttachments}
            onAdd={handleAddReplyAttachment}
            onRemove={handleRemoveReplyAttachment}
          />
          <TouchableOpacity
            style={[styles.submitBtn, (!String(reply || "").trim() || submitting) && styles.submitBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleReply}
            disabled={!String(reply || "").trim() || submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? "Đang gửi..." : "Gửi phản hồi"}
            </Text>
          </TouchableOpacity>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  header: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: PALETTE.text },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 30, gap: 14 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  mutedText: { fontSize: 12.5, fontWeight: "700", color: PALETTE.muted, lineHeight: 18 },
  errorText: { fontSize: 13, fontWeight: "700", color: PALETTE.muted, textAlign: "center" },
  retryBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: PALETTE.navyTint },
  retryText: { color: PALETTE.navy, fontWeight: "800" },
  card: { backgroundColor: PALETTE.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: PALETTE.border },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14.5, fontWeight: "900", color: PALETTE.text },
  subtleMeta: { fontSize: 11.5, fontWeight: "700", color: PALETTE.muted },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11.5, fontWeight: "900" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB" },
  infoLabel: { flex: 1, fontSize: 12.5, fontWeight: "700", color: PALETTE.muted },
  infoValue: { flex: 1, fontSize: 12.5, fontWeight: "700", color: PALETTE.text, textAlign: "right" },
  messageWrap: { marginTop: 10, alignItems: "flex-start" },
  messageWrapRight: { alignItems: "flex-end" },
  messageBubble: { maxWidth: "88%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  messageBubbleUser: { backgroundColor: "#F3F4F6" },
  messageBubbleStaff: { backgroundColor: PALETTE.navy },
  messageSender: { fontSize: 11.5, fontWeight: "900", color: PALETTE.blue },
  messageSenderStaff: { color: "#93C5FD" },
  messageText: { marginTop: 4, fontSize: 13, fontWeight: "700", color: PALETTE.text, lineHeight: 19 },
  messageTextStaff: { color: PALETTE.white },
  messageTime: { marginTop: 6, fontSize: 10.5, fontWeight: "700", color: PALETTE.muted },
  messageTimeStaff: { color: "#CBD5E1" },
  replyInput: { minHeight: 120, marginTop: 12, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 14, fontSize: 13.5, fontWeight: "700", color: PALETTE.text, backgroundColor: "#FFFFFF" },
  submitBtn: { marginTop: 12, height: 48, borderRadius: 16, backgroundColor: PALETTE.navy, alignItems: "center", justifyContent: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});
