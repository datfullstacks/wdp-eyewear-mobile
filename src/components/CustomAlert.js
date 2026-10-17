import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const DEFAULT_ACTIONS = [{ text: "OK" }];

export default function CustomAlert({
  visible,
  title,
  message,
  actions = DEFAULT_ACTIONS,
  onClose,
}) {
  const safeActions = Array.isArray(actions) && actions.length ? actions : DEFAULT_ACTIONS;

  const handlePress = (action) => {
    onClose?.();
    action?.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {!!title ? <Text style={styles.title}>{title}</Text> : null}
          {!!message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {safeActions.map((action, index) => {
              const variant =
                action?.style === "destructive"
                  ? "destructive"
                  : action?.style === "cancel"
                    ? "cancel"
                    : "default";

              return (
                <Pressable
                  key={`${action?.text || "action"}-${index}`}
                  style={[
                    styles.actionBtn,
                    variant === "cancel" && styles.cancelBtn,
                    variant === "destructive" && styles.destructiveBtn,
                  ]}
                  onPress={() => handlePress(action)}
                >
                  <Text
                    style={[
                      styles.actionText,
                      variant === "cancel" && styles.cancelText,
                      variant === "destructive" && styles.destructiveText,
                    ]}
                  >
                    {action?.text || "OK"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.34)",
  },
  sheet: {
    width: "84%",
    maxWidth: 340,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: "#4B5563",
    textAlign: "center",
  },
  actions: {
    marginTop: 18,
    gap: 10,
  },
  actionBtn: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cancelBtn: {
    backgroundColor: "#F3F4F6",
  },
  destructiveBtn: {
    backgroundColor: "#FEE2E2",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563EB",
  },
  cancelText: {
    color: "#111827",
  },
  destructiveText: {
    color: "#DC2626",
  },
});
