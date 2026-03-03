// src/store/favoriteStore.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  addMyFavoriteApi,
  clearMyFavoritesApi,
  getMyFavoriteIdsApi,
  removeMyFavoriteApi,
} from "../services/userService";

const FAV_KEY_BASE = "FAVORITES_V1";
const makeFavKey = (userKey) => (userKey ? `${FAV_KEY_BASE}:${userKey}` : null);

export const useFavoriteStore = create((set, get) => ({
  ids: [],
  isHydrating: true,
  userKey: null,

  applyIds: async (ids) => {
    const normalized = Array.isArray(ids) ? ids.map((x) => String(x)) : [];
    set({ ids: normalized });
    await get().persist(normalized);
    return normalized;
  },

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

    try {
      const remoteIds = await getMyFavoriteIdsApi();
      await get().applyIds(remoteIds);
    } catch {}
  },

  persist: async (ids) => {
    const key = makeFavKey(get().userKey);
    if (!key) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(ids));
    } catch {}
  },

  isFav: (id) => get().ids.includes(id),

  toggle: async (productOrId) => {
    const id = typeof productOrId === "string" ? productOrId : productOrId?.id;
    if (!id) return;

    const ids = get().ids.map((x) => String(x));
    const targetId = String(id);
    const isRemoving = ids.includes(targetId);
    const next = isRemoving ? ids.filter((x) => x !== targetId) : [targetId, ...ids];

    set({ ids: next });
    await get().persist(next);

    try {
      const remoteIds = isRemoving
        ? await removeMyFavoriteApi(targetId)
        : await addMyFavoriteApi(targetId);
      await get().applyIds(remoteIds);
    } catch {
      set({ ids });
      await get().persist(ids);
    }
  },

  clear: async () => {
    const key = makeFavKey(get().userKey);
    set({ ids: [] });
    if (key) await AsyncStorage.removeItem(key).catch(() => {});
    try {
      const remoteIds = await clearMyFavoritesApi();
      await get().applyIds(remoteIds);
    } catch {}
  },
}));
