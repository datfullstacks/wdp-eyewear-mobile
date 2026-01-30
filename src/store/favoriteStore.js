// src/store/favoriteStore.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const FAV_KEY_BASE = "FAVORITES_V1";
const makeFavKey = (userKey) => (userKey ? `${FAV_KEY_BASE}:${userKey}` : null);

export const useFavoriteStore = create((set, get) => ({
  ids: [],
  isHydrating: true,
  userKey: null,

  setUser: async (userKey) => {
    set({ userKey: userKey || null, isHydrating: true, ids: [] });
    await get().hydrate();
  },

  hydrate: async () => {
    const key = makeFavKey(get().userKey);
    if (!key) {
      set({ ids: [], isHydrating: false });
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(key);
      const ids = raw ? JSON.parse(raw) : [];
      set({ ids: Array.isArray(ids) ? ids : [], isHydrating: false });
    } catch {
      set({ ids: [], isHydrating: false });
    }
  },

  persist: async (ids) => {
    const key = makeFavKey(get().userKey);
    if (!key) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(ids));
    } catch {}
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
    const key = makeFavKey(get().userKey);
    set({ ids: [] });
    if (key) AsyncStorage.removeItem(key).catch(() => {});
  },
}));
