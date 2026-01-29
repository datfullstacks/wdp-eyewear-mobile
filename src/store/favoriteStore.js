// src/store/favoriteStore.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const KEY = "FAVORITES_V1";

export const useFavoriteStore = create((set, get) => ({
  ids: [],
  isHydrating: true,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const ids = raw ? JSON.parse(raw) : [];
      set({ ids: Array.isArray(ids) ? ids : [], isHydrating: false });
    } catch (e) {
      set({ ids: [], isHydrating: false });
    }
  },

  persist: async (ids) => {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(ids));
    } catch (e) {}
  },

  isFav: (id) => get().ids.includes(id),

  toggle: (productOrId) => {
    const id = typeof productOrId === "string" ? productOrId : productOrId?.id;
    if (!id) return;

    const ids = get().ids;
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];

    set({ ids: next });
    get().persist(next);
  },

  clear: () => {
    set({ ids: [] });
    get().persist([]);
  },
}));
