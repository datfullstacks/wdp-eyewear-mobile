import { create } from "zustand";

import {
  DEFAULT_RUNTIME_SYSTEM_CONFIG,
  getRuntimeSystemConfigApi,
} from "../services/systemConfigService";

export const useSystemConfigStore = create((set, get) => ({
  config: DEFAULT_RUNTIME_SYSTEM_CONFIG,
  isHydrating: true,
  loading: false,
  error: null,
  lastLoadedAt: null,

  hydrate: async () => {
    try {
      set({ loading: true, error: null });
      const config = await getRuntimeSystemConfigApi();
      set({
        config,
        isHydrating: false,
        loading: false,
        error: null,
        lastLoadedAt: Date.now(),
      });
      return config;
    } catch (error) {
      set({
        isHydrating: false,
        loading: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Không thể tải cấu hình hệ thống.",
      });
      return get().config;
    }
  },

  refresh: async () => {
    try {
      set({ loading: true, error: null });
      const config = await getRuntimeSystemConfigApi();
      set({
        config,
        loading: false,
        error: null,
        lastLoadedAt: Date.now(),
      });
      return config;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Không thể tải cấu hình hệ thống.",
      });
      throw error;
    }
  },
}));

export function getRuntimeSystemConfigSnapshot() {
  return useSystemConfigStore.getState().config || DEFAULT_RUNTIME_SYSTEM_CONFIG;
}
