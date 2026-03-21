import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORE_KEY = "selected_store_v1";

export const useStoreNetworkStore = create((set, get) => ({
  selectedStoreId: null,
  isHydrating: true,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      set({
        selectedStoreId: raw ? String(raw) : null,
        isHydrating: false,
      });
    } catch {
      set({ selectedStoreId: null, isHydrating: false });
    }
  },

  setSelectedStoreId: async (storeId) => {
    const value = storeId ? String(storeId) : null;
    set({ selectedStoreId: value });
    try {
      if (value) {
        await AsyncStorage.setItem(STORE_KEY, value);
      } else {
        await AsyncStorage.removeItem(STORE_KEY);
      }
    } catch {}
  },

  ensureDefaultStore: async (stores = []) => {
    const current = get().selectedStoreId;
    if (current) return;
    const defaultStore = stores.find((store) => store?.isDefault) || stores[0] || null;
    if (!defaultStore?.id) return;
    await get().setSelectedStoreId(defaultStore.id);
  },
}));
