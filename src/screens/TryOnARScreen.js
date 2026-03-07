import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  getNativeTryOnAvailability,
  shouldPreferNativeTryOn,
  startNativeTryOnSession,
} from "../services/nativeTryOnService";

export default function TryOnARScreen({ navigation, route }) {
  const product = useMemo(() => route?.params?.product || null, [route?.params?.product]);
  const tryOn = useMemo(() => route?.params?.tryOn || null, [route?.params?.tryOn]);

  const [nativeLaunchState, setNativeLaunchState] = useState({
    status: "idle",
    message: "",
  });

  const nativeAvailability = useMemo(() => getNativeTryOnAvailability(), []);
  const preferNative = useMemo(() => shouldPreferNativeTryOn(), []);
  const canUseNative = preferNative && nativeAvailability.available;

  const launchNativeSession = useCallback(async () => {
    setNativeLaunchState({
      status: "launching",
      message: `Opening native SDK via ${nativeAvailability.moduleName}...`,
    });

    try {
      const nativeResult = await startNativeTryOnSession({
        product: product || {},
        tryOn: tryOn || {},
      });
      const resultStatus = nativeResult?.result?.status || "launched";
      const resultMessage =
        nativeResult?.result?.message ||
        (resultStatus === "completed"
          ? "Native AR session completed."
          : resultStatus === "cancelled"
            ? "Native AR session closed."
            : "Native AR SDK launched.");

      setNativeLaunchState({
        status: resultStatus,
        message: resultMessage,
      });
    } catch (error) {
      console.warn("[TryOn Native] Launch failed", error);
      setNativeLaunchState({
        status: "failed",
        message: error?.message || "Native AR launch failed",
      });
    }
  }, [nativeAvailability.moduleName, product, tryOn]);

  useEffect(() => {
    if (!preferNative) {
      setNativeLaunchState({
        status: "disabled",
        message: "Native AR is disabled by EXPO_PUBLIC_TRYON_PREFER_NATIVE.",
      });
      return;
    }

    if (!nativeAvailability.available) {
      setNativeLaunchState({
        status: "unavailable",
        message: nativeAvailability.reason || "Native AR module is unavailable.",
      });
      return;
    }

    launchNativeSession();
  }, [launchNativeSession, nativeAvailability.available, nativeAvailability.reason, preferNative]);

  const renderUnavailable = () => (
    <View style={styles.centerWrap}>
      <Ionicons name="camera-outline" size={36} color="#6B7280" />
      <Text style={styles.title}>Native AR Is Not Available</Text>
      <Text style={styles.hint}>
        {nativeLaunchState.message || "Check Banuba Android configuration and rebuild the app."}
      </Text>
    </View>
  );

  const renderNativeLaunchState = () => {
    const isLaunching = nativeLaunchState.status === "launching";
    const isFailed = nativeLaunchState.status === "failed";

    return (
      <View style={styles.centerWrap}>
        <Ionicons name="sparkles-outline" size={34} color={isFailed ? "#D33A2C" : "#2563EB"} />
        <Text style={styles.title}>Native AR SDK</Text>
        <Text style={styles.hint}>
          {nativeLaunchState.message || `Using native module ${nativeAvailability.moduleName}.`}
        </Text>
        <Text style={styles.statusText}>Status: {nativeLaunchState.status || "idle"}</Text>

        {isLaunching ? <ActivityIndicator size="large" color="#2563EB" /> : null}

        <TouchableOpacity
          style={[styles.secondaryBtn, isLaunching && styles.secondaryBtnDisabled]}
          onPress={launchNativeSession}
          activeOpacity={0.9}
          disabled={isLaunching}
        >
          <Text style={styles.secondaryBtnText}>Launch Native AR</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Try-On AR
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {canUseNative ? renderNativeLaunchState() : renderUnavailable()}
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  centerWrap: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  title: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  hint: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    fontWeight: "700",
  },
  statusText: {
    textAlign: "center",
    fontSize: 12,
    color: "#111827",
    fontWeight: "900",
  },
  secondaryBtn: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  secondaryBtnDisabled: {
    opacity: 0.6,
  },
  secondaryBtnText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "900",
  },
});
