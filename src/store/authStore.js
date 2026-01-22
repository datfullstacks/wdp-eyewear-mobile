import { create } from "zustand";
import { getToken, saveToken, removeToken } from "../services/tokenStorage";
import { loginApi, registerApi } from "../services/authService";

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
  isHydrating: true, // đang check token lúc mở app
  error: null,

  hydrate: async () => {
    const token = await getToken();
    set({ token: token || null, isHydrating: false });
  },

  login: async ({ email, password }) => {
    const data = await loginApi({ email, password });
    // tuỳ API bạn trả về key gì:
    const token = getTokenFromResponse(data);
    if (!token) {
      throw new Error("Login response missing a string token");
    }

    await saveToken(token);
    set({ token, user: getUserFromResponse(data), error: null });
  },

    // ✅ REGISTER: đăng ký xong -> login luôn
  register: async ({ name, email, password, role = "customer" }) => {
    const registerData = await registerApi({ name, email, password, role });
    const registerToken = getTokenFromResponse(registerData);
    if (registerToken) {
      await saveToken(registerToken);
      set({ token: registerToken, user: getUserFromResponse(registerData) });
      return;
    }

    // nếu API register KHÔNG trả token thì login lại:
    const data = await loginApi({ email, password });
    const token = getTokenFromResponse(data);
    if (!token) {
      throw new Error("Login response missing a string token");
    }
    await saveToken(token);
    set({ token, user: getUserFromResponse(data) });
  },

  logout: async () => {
    await removeToken();
    set({ token: null, user: null });
  },
}));
