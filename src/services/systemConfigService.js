import { api } from "./apiClient";

export const DEFAULT_RUNTIME_SYSTEM_CONFIG = {
  featureFlags: {
    preorderEnabled: true,
    splitPaymentEnabled: true,
    refundWorkflowEnabled: true,
    managerPolicyEditorEnabled: true,
  },
  payments: {
    codEnabled: true,
  },
  shipping: {
    ghnEnabled: true,
    allowEstimatedShippingFee: true,
  },
  maintenanceMode: false,
};

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function normalizeRuntimeSystemConfig(payload = {}) {
  const featureFlags = payload?.featureFlags || {};
  const payments = payload?.payments || {};
  const shipping = payload?.shipping || {};

  return {
    featureFlags: {
      preorderEnabled: normalizeBoolean(
        featureFlags.preorderEnabled,
        DEFAULT_RUNTIME_SYSTEM_CONFIG.featureFlags.preorderEnabled,
      ),
      splitPaymentEnabled: normalizeBoolean(
        featureFlags.splitPaymentEnabled,
        DEFAULT_RUNTIME_SYSTEM_CONFIG.featureFlags.splitPaymentEnabled,
      ),
      refundWorkflowEnabled: normalizeBoolean(
        featureFlags.refundWorkflowEnabled,
        DEFAULT_RUNTIME_SYSTEM_CONFIG.featureFlags.refundWorkflowEnabled,
      ),
      managerPolicyEditorEnabled: normalizeBoolean(
        featureFlags.managerPolicyEditorEnabled,
        DEFAULT_RUNTIME_SYSTEM_CONFIG.featureFlags.managerPolicyEditorEnabled,
      ),
    },
    payments: {
      codEnabled: normalizeBoolean(
        payments.codEnabled,
        DEFAULT_RUNTIME_SYSTEM_CONFIG.payments.codEnabled,
      ),
    },
    shipping: {
      ghnEnabled: normalizeBoolean(
        shipping.ghnEnabled,
        DEFAULT_RUNTIME_SYSTEM_CONFIG.shipping.ghnEnabled,
      ),
      allowEstimatedShippingFee: normalizeBoolean(
        shipping.allowEstimatedShippingFee,
        DEFAULT_RUNTIME_SYSTEM_CONFIG.shipping.allowEstimatedShippingFee,
      ),
    },
    maintenanceMode: normalizeBoolean(
      payload?.maintenanceMode,
      DEFAULT_RUNTIME_SYSTEM_CONFIG.maintenanceMode,
    ),
  };
}

export async function getRuntimeSystemConfigApi() {
  const res = await api.get("/api/system-config/runtime");
  return normalizeRuntimeSystemConfig(res?.data?.data || res?.data || {});
}
