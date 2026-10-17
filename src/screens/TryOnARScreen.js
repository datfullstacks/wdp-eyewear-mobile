import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
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
import { warmTryOnModelCache } from "../services/tryOnAssetCacheService";

const toText = (value) => String(value ?? "").trim();
const MAX_TRY_ON_MODELS = 8;

const LAUNCH_STATUS_META = {
  idle: {
    label: "Sẵn sàng mở AR",
    tone: "#1D4ED8",
    bg: "#EFF6FF",
    icon: "sparkles-outline",
  },
  launching: {
    label: "Đang mở camera",
    tone: "#1D4ED8",
    bg: "#DBEAFE",
    icon: "radio-outline",
  },
  launched: {
    label: "Đã mở phiên AR",
    tone: "#15803D",
    bg: "#DCFCE7",
    icon: "checkmark-circle-outline",
  },
  completed: {
    label: "Phiên thử hoàn tất",
    tone: "#15803D",
    bg: "#DCFCE7",
    icon: "checkmark-done-outline",
  },
  cancelled: {
    label: "Bạn đã đóng phiên thử",
    tone: "#6B7280",
    bg: "#F3F4F6",
    icon: "close-circle-outline",
  },
  failed: {
    label: "Mở AR thất bại",
    tone: "#B91C1C",
    bg: "#FEE2E2",
    icon: "alert-circle-outline",
  },
  unavailable: {
    label: "Native AR chưa khả dụng",
    tone: "#B45309",
    bg: "#FEF3C7",
    icon: "warning-outline",
  },
  disabled: {
    label: "Native AR đang tắt",
    tone: "#6B7280",
    bg: "#F3F4F6",
    icon: "pause-circle-outline",
  },
  not_ready: {
    label: "Model chưa sẵn sàng",
    tone: "#B45309",
    bg: "#FEF3C7",
    icon: "time-outline",
  },
};

function buildFallbackModel(tryOn = {}) {
  return {
    id: "default",
    label: "Mặc định",
    ready: Boolean(tryOn?.ready),
    tryOn: tryOn || {},
  };
}

function normalizeRouteModels(models = [], fallbackTryOn = null) {
  if (!Array.isArray(models) || models.length === 0) {
    return fallbackTryOn ? [buildFallbackModel(fallbackTryOn)].slice(0, MAX_TRY_ON_MODELS) : [];
  }

  return models.slice(0, MAX_TRY_ON_MODELS).map((model, index) => ({
    id: toText(model?.id) || `model-${index + 1}`,
    label: toText(model?.label) || `Model ${index + 1}`,
    ready: Boolean(model?.ready ?? model?.tryOn?.ready),
    tryOn: model?.tryOn || {},
  }));
}

function getLaunchMeta(status) {
  return LAUNCH_STATUS_META[toText(status).toLowerCase()] || LAUNCH_STATUS_META.idle;
}

export default function TryOnARScreen({ navigation, route }) {
  const product = useMemo(() => route?.params?.product || null, [route?.params?.product]);
  const routeTryOn = useMemo(() => route?.params?.tryOn || null, [route?.params?.tryOn]);
  const models = useMemo(
    () => normalizeRouteModels(route?.params?.tryOnModels, routeTryOn),
    [route?.params?.tryOnModels, routeTryOn]
  );
  const initialSelectedModelId = useMemo(() => {
    const requestedId = toText(route?.params?.selectedTryOnModelId);
    if (requestedId && models.some((model) => model.id === requestedId)) return requestedId;
    return models.find((model) => model.ready)?.id || models[0]?.id || "";
  }, [models, route?.params?.selectedTryOnModelId]);
  const [selectedModelId, setSelectedModelId] = useState(initialSelectedModelId);
  const [nativeLaunchState, setNativeLaunchState] = useState({
    status: "idle",
    message: "",
  });

  const nativeAvailability = useMemo(() => getNativeTryOnAvailability(), []);
  const preferNative = useMemo(() => shouldPreferNativeTryOn(), []);
  const canUseNative = preferNative && nativeAvailability.available;
  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || models[0] || null,
    [models, selectedModelId]
  );
  const activeTryOn = useMemo(
    () => selectedModel?.tryOn || routeTryOn || null,
    [routeTryOn, selectedModel]
  );
  const readyModelCount = useMemo(
    () => models.filter((model) => model.ready).length,
    [models]
  );
  const launchMeta = useMemo(
    () => getLaunchMeta(nativeLaunchState.status),
    [nativeLaunchState.status]
  );

  useEffect(() => {
    setSelectedModelId(initialSelectedModelId);
  }, [initialSelectedModelId]);

  useEffect(() => {
    models.forEach((model) => {
      if (!model?.tryOn?.glbUrl && !model?.tryOn?.usdzUrl) return;
      Promise.resolve(warmTryOnModelCache(model.tryOn || {})).catch(() => {});
    });
  }, [models]);

  const launchNativeSession = useCallback(async () => {
    if (!activeTryOn?.ready) {
      setNativeLaunchState({
        status: "not_ready",
        message: "Mẫu đang chọn chưa sẵn sàng để mở AR.",
      });
      return;
    }

    setNativeLaunchState({
      status: "launching",
      message: `Đang mở ${selectedModel?.label || "model"} với ${nativeAvailability.moduleName}...`,
    });

    try {
      const nativeResult = await startNativeTryOnSession({
        product: product || {},
        tryOn: {
          ...(activeTryOn || {}),
          selectedModelId: selectedModel?.id || "",
          models: models.map((model) => ({
            id: model.id,
            label: model.label,
            ready: Boolean(model.ready),
            glbUrl: toText(model?.tryOn?.glbUrl),
            usdzUrl: toText(model?.tryOn?.usdzUrl),
            arUrl: toText(model?.tryOn?.arUrl),
            launchUrl: toText(model?.tryOn?.launchUrl),
            effectPath: toText(model?.tryOn?.effectPath),
            scene: toText(model?.tryOn?.scene),
            resourcePaths: Array.isArray(model?.tryOn?.resourcePaths)
              ? model.tryOn.resourcePaths
              : [],
            prefab:
              model?.tryOn?.prefab && typeof model.tryOn.prefab === "object"
                ? model.tryOn.prefab
                : undefined,
          })),
        },
      });

      const resultStatus = nativeResult?.result?.status || "launched";
      const resultMessage =
        nativeResult?.result?.message ||
        (resultStatus === "completed"
          ? "Phiên thử đã hoàn tất."
          : resultStatus === "cancelled"
            ? "Bạn đã đóng phiên thử kính."
            : "Native AR đã được mở.");

      setNativeLaunchState({
        status: resultStatus,
        message: resultMessage,
      });
    } catch (error) {
      // console.warn("[TryOn Native] Launch failed", error);
      setNativeLaunchState({
        status: "failed",
        message: error?.message || "Không mở được phiên AR.",
      });
    }
  }, [activeTryOn, models, nativeAvailability.moduleName, product, selectedModel]);

  useEffect(() => {
    if (!preferNative) {
      setNativeLaunchState({
        status: "disabled",
        message: "Native AR đang bị tắt trong cấu hình môi trường.",
      });
      return;
    }

    if (!nativeAvailability.available) {
      setNativeLaunchState({
        status: "unavailable",
        message: nativeAvailability.reason || "Native AR chưa sẵn sàng trên thiết bị này.",
      });
      return;
    }

    if (!activeTryOn) {
      setNativeLaunchState({
        status: "idle",
        message: "Sản phẩm này chưa có model thử kính.",
      });
      return;
    }

    if (!activeTryOn.ready) {
      setNativeLaunchState({
        status: "not_ready",
        message: "Mẫu đang chọn chưa sẵn sàng.",
      });
      return;
    }

    launchNativeSession();
  }, [activeTryOn, launchNativeSession, nativeAvailability.available, nativeAvailability.reason, preferNative]);

  const isLaunching = nativeLaunchState.status === "launching";
  const canLaunchSelectedModel = Boolean(activeTryOn?.ready) && !isLaunching;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Studio Thử Kính
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#2563EB" />
              <Text style={styles.heroBadgeText}>Native AR</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: launchMeta.bg }]}>
              <Ionicons name={launchMeta.icon} size={13} color={launchMeta.tone} />
              <Text style={[styles.statusPillText, { color: launchMeta.tone }]}>
                {launchMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.productName}>
            {toText(product?.name) || "Sản phẩm thử kính"}
          </Text>
          <Text style={styles.heroHint}>
            Chọn model bên dưới rồi mở camera để thử trực tiếp trên gương mặt.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Mẫu sẵn sàng</Text>
              <Text style={styles.heroStatValue}>
                {readyModelCount}/{models.length || 0}
              </Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Đang chọn</Text>
              <Text style={styles.heroStatValue} numberOfLines={1}>
                {selectedModel?.label || "—"}
              </Text>
            </View>
          </View>
        </View>

        {models.length > 0 ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Chọn mẫu thử</Text>
              <Text style={styles.sectionMeta}>{readyModelCount}/{models.length} sẵn sàng</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modelChipRow}
            >
              {models.map((model) => {
                const active = model.id === selectedModelId;
                return (
                  <TouchableOpacity
                    key={model.id}
                    activeOpacity={0.9}
                    onPress={() => setSelectedModelId(model.id)}
                    style={[
                      styles.modelChip,
                      active && styles.modelChipActive,
                      !model.ready && styles.modelChipDisabled,
                    ]}
                  >
                    <View style={styles.modelChipTop}>
                      <Text
                        style={[
                          styles.modelChipText,
                          active && styles.modelChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {model.label}
                      </Text>
                      <View
                        style={[
                          styles.readyDot,
                          { backgroundColor: model.ready ? "#15803D" : "#9CA3AF" },
                        ]}
                      />
                    </View>
                    <Text style={styles.modelChipStatus}>
                      {model.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.launchCard}>
          <View style={[styles.launchIconWrap, { backgroundColor: launchMeta.bg }]}>
            {isLaunching ? (
              <ActivityIndicator size="small" color={launchMeta.tone} />
            ) : (
              <Ionicons name={launchMeta.icon} size={24} color={launchMeta.tone} />
            )}
          </View>

          <Text style={styles.launchTitle}>
            {isLaunching ? "Đang mở camera AR..." : "Phiên thử kính"}
          </Text>
          <Text style={styles.launchHint}>
            {nativeLaunchState.message || `Sử dụng ${nativeAvailability.moduleName}.`}
          </Text>

          {selectedModel ? (
            <View style={styles.selectedModelBanner}>
              <Ionicons name="glasses-outline" size={14} color="#111827" />
              <Text style={styles.selectedModelText}>
                Mẫu hiện tại: {selectedModel.label}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !canLaunchSelectedModel && styles.primaryBtnDisabled,
            ]}
            onPress={launchNativeSession}
            activeOpacity={0.9}
            disabled={!canLaunchSelectedModel}
          >
            {isLaunching ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.primaryBtnText}>
              {isLaunching
                ? "Đang thử kính..."
                : activeTryOn?.ready
                  ? "Đang thử kính"
                  : "Mẫu chưa sẵn sàng"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Ionicons name="bulb-outline" size={18} color="#2563EB" />
          </View>
          <View style={styles.tipBody}>
            <Text style={styles.tipTitle}>Mẹo dùng thử</Text>
            <Text style={styles.tipText}>
              Đứng nơi đủ sáng, giữ máy ngang tầm mắt và đổi giữa các model để so nhanh màu hoặc size.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EEF4FF",
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
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
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1D4ED8",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  productName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: "#111827",
  },
  heroHint: {
    fontSize: 13,
    lineHeight: 20,
    color: "#4B5563",
    fontWeight: "700",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },
  modelChipRow: {
    gap: 10,
    paddingRight: 16,
  },
  modelChip: {
    minWidth: 132,
    maxWidth: 156,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  modelChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EEF4FF",
  },
  modelChipDisabled: {
    opacity: 0.6,
  },
  modelChipTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modelChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  modelChipTextActive: {
    color: "#1D4ED8",
  },
  readyDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  modelChipStatus: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
  },
  launchCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: "center",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 5,
  },
  launchIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  launchTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
  },
  launchHint: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    fontWeight: "700",
  },
  selectedModelBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedModelText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  primaryBtn: {
    marginTop: 4,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 220,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  tipCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  tipBody: {
    flex: 1,
    gap: 4,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
    fontWeight: "700",
  },
});
