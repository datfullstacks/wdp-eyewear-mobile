import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProductModelViewer from "./ProductModelViewer";

export default function Product3DModal({
  visible,
  onClose,
  product,
  selectedVariantId,
}) {
  const variantAssets =
    selectedVariantId && product?.media?.byVariant?.[selectedVariantId]
      ? product.media.byVariant[selectedVariantId]
      : [];

  const variant3D = variantAssets.find((a) => a?.assetType === "3d");
  const default3D = product?.model3D?.defaultAsset;

  const glbUrl =
    variant3D?.ar?.glbUrl ||
    variant3D?.url ||
    product?.tryOn?.glbUrl ||
    default3D?.ar?.glbUrl ||
    default3D?.url ||
    "";

  const prefab = product?.tryOn?.prefab || {};

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Xem model 3D</Text>
              <Text style={styles.subTitle} numberOfLines={1}>
                {product?.name || ""}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.viewerWrap}>
            <ProductModelViewer glbUrl={glbUrl} prefab={prefab} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    minHeight: 420,
    maxHeight: "82%",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  subTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    maxWidth: 240,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  viewerWrap: {
    height: 420,
    backgroundColor: "#F9FAFB",
  },
});