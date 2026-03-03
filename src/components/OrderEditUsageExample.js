// OrderEditUsageExample.js
// Shows how to integrate OrderItemEditModal into CheckoutStatusScreen
// or an Orders list screen.
//
// Copy OrderItemEditModal.js → components/OrderItemEditModal.js
// Then use like this:

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import OrderItemEditModal from "../components/OrderItemEditModal";

/**
 * Example: render each order item with an "Edit" button.
 * Use inside CheckoutStatusScreen or an OrderDetailScreen.
 *
 * @param {object} order – normalized order object (from normalizeOrder())
 */
export function OrderItemsList({ order }) {
  const [editingItem, setEditingItem] = useState(null);
  const [localPatches, setLocalPatches] = useState({}); // key = item index

  const handleSave = (patch, idx) => {
    // TODO: wire to API when available
    // await api.patch(`/api/orders/${order.orderId}/items/${item.id}`, patch)
    setLocalPatches((prev) => ({ ...prev, [idx]: patch }));
    setEditingItem(null);
  };

  return (
    <View>
      {(order.items || []).map((item, idx) => {
        const patch = localPatches[idx] || {};
        const merged = { ...item, ...patch };

        // Build productColors/productSizes from the product if available.
        // In a real screen you'd have this from the product data.
        // For now we pass empty arrays and the modal handles it gracefully.
        const enrichedItem = {
          ...merged,
          productType: merged.productType || (merged.preorder ? "LENS" : "FRAME"),
          orderType: merged.orderType || "READY",
          productColors: merged.productColors || [],
          productSizes: merged.productSizes || [],
        };

        return (
          <View key={idx} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{merged.name}</Text>
              <Text style={styles.itemMeta}>{merged.qty} x {new Intl.NumberFormat("vi-VN").format(merged.price)}đ</Text>
              {patch.variantText ? (
                <Text style={styles.patchNote}>Đã chỉnh: {patch.variantText}</Text>
              ) : null}
              {patch.rxOD ? (
                <Text style={styles.patchNote}>
                  Rx OD: CYL {patch.rxOD.CYL} / AXIS {patch.rxOD.AXIS}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditingItem({ item: enrichedItem, idx })}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={14} color="#2563EB" />
              <Text style={styles.editBtnText}>Sửa</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <OrderItemEditModal
        visible={Boolean(editingItem)}
        orderItem={editingItem?.item || null}
        orderCreatedAt={order.createdAt}
        onClose={() => setEditingItem(null)}
        onSave={(patch) => handleSave(patch, editingItem?.idx)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    gap: 10,
  },
  itemName: { fontSize: 13, fontWeight: "900", color: "#111827" },
  itemMeta: { fontSize: 12, fontWeight: "700", color: "#6B7280", marginTop: 2 },
  patchNote: { fontSize: 11.5, fontWeight: "700", color: "#2563EB", marginTop: 3 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
  },
  editBtnText: { fontSize: 12, fontWeight: "800", color: "#2563EB" },
});