import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function HomeFooter({ onChatPress, onCallPress }) {
  return (
    <View style={styles.wrap}>
      {/* Top feature bar */}
      <View style={styles.featureCard}>
        <FeatureItem icon="shield-checkmark-outline" label="Chính hãng" />
        <FeatureItem icon="reload-outline" label="Đổi trả 7 ngày" />
        <FeatureItem icon="construct-outline" label="Bảo hành" />
        <FeatureItem icon="rocket-outline" label="Giao nhanh" />
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.85} onPress={onChatPress}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#111827" />
          <Text style={styles.actionText}>Chat tư vấn</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.85} onPress={onCallPress}>
          <Ionicons name="call-outline" size={18} color="#111827" />
          <Text style={styles.actionText}>Gọi hỗ trợ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FeatureItem({ icon, label }) {
  return (
    <View style={styles.featureItem}>
      <Ionicons name={icon} size={22} color="#111827" />
      <Text style={styles.featureText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    paddingBottom: 24,
  },

  featureCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  featureItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },

  featureText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    paddingHorizontal: 4,
  },

  actionsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },

  actionBtn: {
    flex: 1,
    maxWidth: 200,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  actionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
});
