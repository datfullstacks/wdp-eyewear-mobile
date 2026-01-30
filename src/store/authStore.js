import { create } from "zustand";
import { getToken, saveToken, removeToken } from "../services/tokenStorage";
import { loginApi, registerApi } from "../services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY_STORAGE = "AUTH_USERKEY_V1";

const makeUserKey = ({ user, email }) => {
  // ưu tiên id, fallback email
  return user?.id || user?._id || user?.email || email || null;
};

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

const getUserFromResponse = (data) => {
  return data?.user ?? data?.data?.user ?? data?.result?.user ?? null;
};

export const useAuthStore = create((set) => ({
  token: null,
  user: null,
  userKey: null,
  isHydrating: true,
  error: null,

  hydrate: async () => {
    const token = await getToken();
    const userKey = await AsyncStorage.getItem(USER_KEY_STORAGE);
    set({
      token: token || null,
      userKey: userKey || null,
      isHydrating: false,
    });
  },

  login: async ({ email, password }) => {
    const data = await loginApi({ email, password });

    const token = getTokenFromResponse(data);
    if (!token) throw new Error("Login response missing a string token");

    const user = getUserFromResponse(data);
    const userKey = makeUserKey({ user, email });

    await saveToken(token);
    if (userKey) await AsyncStorage.setItem(USER_KEY_STORAGE, String(userKey));

    set({ token, user, userKey, error: null });
  },

  register: async ({ name, email, password, role = "customer" }) => {
    const registerData = await registerApi({ name, email, password, role });
    const registerToken = getTokenFromResponse(registerData);

    const registerUser = getUserFromResponse(registerData);
    const registerUserKey = makeUserKey({ user: registerUser, email });

    if (registerToken) {
      await saveToken(registerToken);

      if (registerUserKey) {
        await AsyncStorage.setItem(USER_KEY_STORAGE, String(registerUserKey));
      }

      set({
        token: registerToken,
        user: registerUser,
        userKey: registerUserKey,
        error: null,
      });
      return;
    }

    // nếu API register KHÔNG trả token thì login lại:
    const data = await loginApi({ email, password });
    const token = getTokenFromResponse(data);
    if (!token) throw new Error("Login response missing a string token");

    const user = getUserFromResponse(data);
    const userKey = makeUserKey({ user, email });

    await saveToken(token);
    if (userKey) await AsyncStorage.setItem(USER_KEY_STORAGE, String(userKey));

    set({ token, user, userKey, error: null });
  },

  logout: async () => {
    await removeToken();
    await AsyncStorage.removeItem(USER_KEY_STORAGE);
    set({ token: null, user: null, userKey: null, error: null });
  },
}));
