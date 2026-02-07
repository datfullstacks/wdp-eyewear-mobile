import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createSupportTicketApi,
  getSupportTicketsApi,
  replySupportTicketApi,
} from "../services/supportService";

function formatTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function TicketCard({ item, onReply }) {
  const [message, setMessage] = useState("");
  const latestMessage =
    Array.isArray(item?.messages) && item.messages.length
      ? item.messages[item.messages.length - 1]?.message
      : "";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.subject}>{item?.subject || "--"}</Text>
        <Text style={styles.status}>{item?.status || "open"}</Text>
      </View>

      {!!latestMessage ? <Text style={styles.message}>{latestMessage}</Text> : null}
      <Text style={styles.time}>Updated: {formatTime(item?.lastMessageAt || item?.updatedAt)}</Text>

      <View style={styles.replyRow}>
        <TextInput
          style={styles.replyInput}
          placeholder="Reply..."
          value={message}
          onChangeText={setMessage}
        />
        <TouchableOpacity
          style={styles.replyBtn}
          activeOpacity={0.85}
          onPress={() => {
            const trimmed = message.trim();
            if (!trimmed) return;
            onReply(item?._id, trimmed);
            setMessage("");
          }}
        >
          <Text style={styles.replyBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SupportScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      const result = await getSupportTicketsApi({ page: 1, limit: 50 });
      setItems(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Khong tai duoc support tickets";
      Alert.alert("Support", msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onCreate = async () => {
    if (submitting) return;
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Support", "Subject va message la bat buoc.");
      return;
    }

    try {
      setSubmitting(true);
      await createSupportTicketApi({ subject, message });
      setSubject("");
      setMessage("");
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Khong tao duoc support ticket";
      Alert.alert("Support", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onReply = async (ticketId, text) => {
    try {
      await replySupportTicketApi(ticketId, { message: text });
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Khong gui reply duoc";
      Alert.alert("Support", msg);
    }
  };

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
          <Text style={styles.headerTitle}>Support</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Create support ticket</Text>
        <TextInput
          style={styles.input}
          placeholder="Subject"
          value={subject}
          onChangeText={setSubject}
        />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Message"
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
          <Text style={styles.submitText}>{submitting ? "Sending..." : "Create ticket"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item?._id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <TicketCard item={item} onReply={onReply} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No support ticket yet</Text>
            </View>
          }
        />
      )}
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
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  formCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  formTitle: { fontSize: 13, fontWeight: "900", color: "#111827", marginBottom: 10 },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  inputMulti: { height: 88, paddingTop: 10, paddingBottom: 10 },
  submitBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: "900" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  subject: { fontSize: 13.5, fontWeight: "900", color: "#111827", flex: 1 },
  status: { fontSize: 11.5, fontWeight: "900", color: "#2563EB" },
  message: { marginTop: 6, fontSize: 12.5, fontWeight: "700", color: "#6B7280" },
  time: { marginTop: 8, fontSize: 11.5, fontWeight: "700", color: "#9CA3AF" },
  replyRow: { marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center" },
  replyInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  replyBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  replyBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12.5 },
  empty: { paddingTop: 20, alignItems: "center" },
  emptyText: { color: "#6B7280", fontWeight: "700" },
});
