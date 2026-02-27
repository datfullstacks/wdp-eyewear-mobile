import { create } from "zustand";
import { getToken, saveToken, removeToken } from "../services/tokenStorage";
import { loginApi, registerApi, googleLoginApi, meApi } from "../services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY_STORAGE = "AUTH_USERKEY_V1";

const makeUserKey = ({ user, email }) => user?.id || user?._id || user?.email || email || null;

const getTokenFromResponse = (data) => {
  if (typeof data === "string") return data;
  const token =
    data?.accessToken ??
    data?.token ??
    data?.data?.accessToken ??
    data?.data?.token ??
    data?.result?.accessToken ??
    data?.result?.token;
  return typeof token === "string" ? token : null;
};

const getUserFromResponse = (data) => data?.user ?? data?.data?.user ?? data?.result?.user ?? null;

export const useAuthStore = create((set, get) => ({
  token: null,
  user: null,
  userKey: null,
  isHydrating: true,
  error: null,

  fetchMe: async () => {
    const token = get().token;
    if (!token) {
      set({ user: null });
      return null;
    }

    try {
      const user = await meApi(); 
      const userKey = makeUserKey({ user, email: user?.email });

      if (userKey) await AsyncStorage.setItem(USER_KEY_STORAGE, String(userKey));

      set({ user, userKey, error: null });
      return user;
    } catch (e) {
      await get().logout();
      return null;
    }
  },

  hydrate: async () => {
    const token = await getToken();
    const userKey = await AsyncStorage.getItem(USER_KEY_STORAGE);

    set({
      token: token || null,
      userKey: userKey || null,
      isHydrating: false,
    });
    if (token) {
      await get().fetchMe();
    }
  },

  login: async ({ email, password }) => {
    const data = await loginApi({ email, password });

    const token = getTokenFromResponse(data);
    if (!token) throw new Error("Login response missing a string token");

    await saveToken(token);
    set({ token, error: null });
    const userFromLogin = getUserFromResponse(data);
    if (userFromLogin) {
      const userKey = makeUserKey({ user: userFromLogin, email });
      if (userKey) await AsyncStorage.setItem(USER_KEY_STORAGE, String(userKey));
      set({ user: userFromLogin, userKey });
    } else {
      await get().fetchMe();
    }
  },

  register: async ({ name, email, password, role = "customer" }) => {
    const registerData = await registerApi({ name, email, password, role });
    const registerToken = getTokenFromResponse(registerData);

    if (registerToken) {
      await saveToken(registerToken);
      set({ token: registerToken, error: null });

      const registerUser = getUserFromResponse(registerData);
      if (registerUser) {
        const k = makeUserKey({ user: registerUser, email });
        if (k) await AsyncStorage.setItem(USER_KEY_STORAGE, String(k));
        set({ user: registerUser, userKey: k });
      } else {
        await get().fetchMe();
      }
      return;
    }

    await get().login({ email, password });
  },

  loginWithGoogle: async ({ accessToken }) => {
    const data = await googleLoginApi({ accessToken });

    const token = getTokenFromResponse(data);
    if (!token) throw new Error("Google login response missing a string token");

    await saveToken(token);
    set({ token, error: null });

    const userFromLogin = getUserFromResponse(data);
    if (userFromLogin) {
      const userKey = makeUserKey({ user: userFromLogin });
      if (userKey) await AsyncStorage.setItem(USER_KEY_STORAGE, String(userKey));
      set({ user: userFromLogin, userKey });
    } else {
      await get().fetchMe();
    }
  },

  logout: async () => {
    await removeToken();
    await AsyncStorage.removeItem(USER_KEY_STORAGE);
    set({ token: null, user: null, userKey: null, error: null });
  },
}));
