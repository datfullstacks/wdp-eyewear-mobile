import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import { buildTryOnSessionUrl, getTryOnFallbackUrl } from "../services/tryOnService";
import {
  getNativeTryOnAvailability,
  shouldPreferNativeTryOn,
  startNativeTryOnSession,
} from "../services/nativeTryOnService";

export default function TryOnARScreen({ navigation, route }) {
  const product = useMemo(() => route?.params?.product || null, [route?.params?.product]);
  const tryOn = useMemo(() => route?.params?.tryOn || null, [route?.params?.tryOn]);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [forceWebFallback, setForceWebFallback] = useState(false);
  const [nativeLaunchState, setNativeLaunchState] = useState({
    status: "idle",
    message: "",
  });

  const { sessionUrl, fallbackUrl } = useMemo(
    () => buildTryOnSessionUrl({ product: product || {}, tryOn: tryOn || {} }),
    [product, tryOn]
  );

  const directFallbackUrl = useMemo(() => getTryOnFallbackUrl(tryOn || {}), [tryOn]);
  const nativeAvailability = useMemo(() => getNativeTryOnAvailability(), []);
  const preferNative = useMemo(() => shouldPreferNativeTryOn(), []);
  const shouldUseNative = preferNative && nativeAvailability.available && !forceWebFallback;

  const openFallback = async () => {
    const targetUrl = fallbackUrl || directFallbackUrl;
    if (!targetUrl) return;

    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) await Linking.openURL(targetUrl);
    } catch (error) {
      // Ignore fallback open errors to avoid breaking the screen
    }
  };

  const launchNativeSession = useCallback(async () => {
    setNativeLaunchState({
      status: "launching",
      message: `Opening native SDK via ${nativeAvailability.moduleName}...`,
    });

    try {
      await startNativeTryOnSession({
        product: product || {},
        tryOn: tryOn || {},
        fallbackUrl: fallbackUrl || directFallbackUrl,
      });
      setNativeLaunchState({
        status: "launched",
        message: "Native AR SDK launched. If no AR view appears, switch to web fallback.",
      });
    } catch (error) {
      setNativeLaunchState({
        status: "failed",
        message: error?.message || "Native AR launch failed",
      });
    }
  }, [directFallbackUrl, fallbackUrl, nativeAvailability.moduleName, product, tryOn]);

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

    if (!forceWebFallback) {
      launchNativeSession();
    }
  }, [forceWebFallback, launchNativeSession, nativeAvailability.available, nativeAvailability.reason, preferNative]);

  const renderUnsupported = () => (
    <View style={styles.centerWrap}>
      <Ionicons name="camera-outline" size={36} color="#6B7280" />
      <Text style={styles.title}>AR Session Is Not Configured</Text>
      <Text style={styles.hint}>
        Set `EXPO_PUBLIC_TRYON_SDK_URL` or `media.tryOn.arUrl` to a web AR endpoint that supports face tracking.
      </Text>
      {(fallbackUrl || directFallbackUrl) ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={openFallback} activeOpacity={0.9}>
          <Text style={styles.secondaryBtnText}>Open Fallback Link</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderError = () => (
    <View style={styles.centerWrap}>
      <Ionicons name="warning-outline" size={34} color="#D33A2C" />
      <Text style={styles.title}>Cannot Load AR Session</Text>
      <Text style={styles.hint}>
        Check network connection and SDK endpoint. You can still open fallback AR URL below.
      </Text>
      {(fallbackUrl || directFallbackUrl) ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={openFallback} activeOpacity={0.9}>
          <Text style={styles.secondaryBtnText}>Open Fallback Link</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderNativeLaunchState = () => (
    <View style={styles.centerWrap}>
      <Ionicons name="sparkles-outline" size={34} color="#2563EB" />
      <Text style={styles.title}>Native AR SDK</Text>
      <Text style={styles.hint}>
        {nativeLaunchState.message ||
          `Using module ${nativeAvailability.moduleName}. Implement startTryOnSession/startSession/openTryOn in native code.`}
      </Text>

      {nativeLaunchState.status === "launching" ? (
        <ActivityIndicator size="large" color="#2563EB" />
      ) : null}

      <TouchableOpacity style={styles.secondaryBtn} onPress={launchNativeSession} activeOpacity={0.9}>
        <Text style={styles.secondaryBtnText}>Launch Native AR</Text>
      </TouchableOpacity>

      {sessionUrl ? (
        <TouchableOpacity
          style={[styles.secondaryBtn, styles.secondaryBtnMuted]}
          onPress={() => setForceWebFallback(true)}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryBtnText}>Use Web Fallback</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const shouldShowNativePanel =
    shouldUseNative &&
    (nativeLaunchState.status === "launching" ||
      nativeLaunchState.status === "launched" ||
      nativeLaunchState.status === "failed");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Try-On AR
        </Text>
        <TouchableOpacity
          onPress={() => setForceWebFallback((prev) => !prev)}
          style={styles.iconBtn}
          activeOpacity={0.85}
        >
          <Ionicons
            name={forceWebFallback ? "globe-outline" : "phone-portrait-outline"}
            size={18}
            color="#111827"
          />
        </TouchableOpacity>
      </View>

      {shouldShowNativePanel ? (
        renderNativeLaunchState()
      ) : !sessionUrl ? (
        renderUnsupported()
      ) : hasError ? (
        renderError()
      ) : (
        <View style={styles.webWrap}>
          <WebView
            source={{ uri: sessionUrl }}
            style={styles.web}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            onLoadStart={() => {
              setIsLoading(true);
              setHasError(false);
            }}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />

          {isLoading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Starting AR session...</Text>
            </View>
          ) : null}
        </View>
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
  webWrap: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: "#000",
  },
  web: { flex: 1, backgroundColor: "#000" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    gap: 10,
  },
  loadingText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
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
  secondaryBtn: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  secondaryBtnText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "900",
  },
  secondaryBtnMuted: {
    backgroundColor: "#111827",
  },
});
