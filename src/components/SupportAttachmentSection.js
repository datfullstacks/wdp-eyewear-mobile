import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  normalizeSupportAttachments,
  SUPPORT_ATTACHMENT_MAX_ITEMS,
} from "../services/supportMediaService";

const PALETTE = {
  text: "#162033",
  muted: "#6B7280",
  border: "#E3E8EF",
  white: "#FFFFFF",
  navy: "#0c2c5c",
  navyTint: "#EEF3F8",
  danger: "#B91C1C",
  dangerBg: "#FEE2E2",
  surface: "#F7F8FA",
};

async function openAttachmentUrl(url) {
  const target = String(url || "").trim();
  if (!target) return;

  try {
    const supported = await Linking.canOpenURL(target);
    if (supported) {
      await Linking.openURL(target);
    }
  } catch (error) {
    // Intentionally ignore failed previews and keep the current flow responsive.
  }
}

function AttachmentCard({
  attachment,
  compact = false,
  editable = false,
  onRemove,
}) {
  const isVideo = attachment?.type === "video";
  const title =
    attachment?.name || (isVideo ? "Video chứng minh" : "Ảnh chứng minh");

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      style={[styles.attachmentCard, compact && styles.attachmentCardCompact]}
      onPress={() => openAttachmentUrl(attachment?.url)}
    >
      {isVideo ? (
        <View
          style={[styles.videoPreview, compact && styles.videoPreviewCompact]}
        >
          <Ionicons
            name="videocam"
            size={compact ? 20 : 26}
            color={PALETTE.navy}
          />
          <Text style={styles.videoLabel}>Video</Text>
        </View>
      ) : (
        <Image
          source={{ uri: attachment?.url }}
          style={[styles.imagePreview, compact && styles.imagePreviewCompact]}
        />
      )}

      <View style={styles.captionWrap}>
        <Text style={styles.captionText} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {editable && typeof onRemove === "function" ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onRemove?.(attachment)}
          style={styles.removeBtn}
        >
          <Ionicons name="close" size={12} color={PALETTE.danger} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

export default function SupportAttachmentSection({
  title = "",
  helperText = "",
  emptyText = "",
  attachments = [],
  editable = false,
  uploading = false,
  onAdd,
  onRemove,
  compact = false,
  disabled = false,
  maxItems = SUPPORT_ATTACHMENT_MAX_ITEMS,
  addLabel = "Thêm ảnh/video",
}) {
  const items = useMemo(
    () => normalizeSupportAttachments(attachments),
    [attachments],
  );
  const showAddCard = editable && typeof onAdd === "function";
  const canAdd = showAddCard && !disabled && !uploading && items.length < maxItems;

  return (
    <View style={[styles.section, compact && styles.sectionCompact]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <View style={[styles.grid, compact && styles.gridCompact]}>
        {items.map((attachment) => (
          <AttachmentCard
            key={attachment.url}
            attachment={attachment}
            compact={compact}
            editable={editable}
            onRemove={onRemove}
          />
        ))}

        {showAddCard ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.addCard,
              compact && styles.addCardCompact,
              !canAdd && styles.addCardDisabled,
            ]}
            onPress={onAdd}
            disabled={!canAdd}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={PALETTE.navy} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={PALETTE.navy} />
                <Text style={styles.addLabel}>{addLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {!items.length && emptyText ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : null}

      {editable && items.length >= maxItems ? (
        <Text style={styles.limitText}>Đã đủ {maxItems} tệp đính kèm.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
  },
  sectionCompact: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: "900",
    color: PALETTE.text,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    color: PALETTE.muted,
  },
  grid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridCompact: {
    marginTop: 8,
    gap: 8,
  },
  attachmentCard: {
    width: 108,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
  },
  attachmentCardCompact: {
    width: 88,
    borderRadius: 14,
  },
  imagePreview: {
    width: "100%",
    height: 86,
    backgroundColor: PALETTE.surface,
  },
  imagePreviewCompact: {
    height: 72,
  },
  videoPreview: {
    width: "100%",
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: PALETTE.navyTint,
  },
  videoPreviewCompact: {
    height: 72,
  },
  videoLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    color: PALETTE.navy,
  },
  captionWrap: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  captionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: PALETTE.text,
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.dangerBg,
  },
  addCard: {
    width: 108,
    minHeight: 122,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: PALETTE.navy,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: PALETTE.navyTint,
  },
  addCardCompact: {
    width: 88,
    minHeight: 108,
    borderRadius: 14,
  },
  addCardDisabled: {
    opacity: 0.6,
  },
  addLabel: {
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: "800",
    lineHeight: 16,
    color: PALETTE.navy,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  limitText: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: "800",
    color: PALETTE.muted,
  },
});
