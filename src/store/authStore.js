import { create } from "zustand";
import { getToken, saveToken, removeToken } from "../services/tokenStorage";
import { loginApi } from "../services/authService";

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
    const token = data.accessToken || data.token;

    await saveToken(token);
    set({ token, user: data.user || null, error: null });
  },

    // ✅ REGISTER: đăng ký xong -> login luôn
  register: async ({ name, email, password, role = "customer" }) => {
    await registerApi({ name, email, password, role });

    // nếu API register KHÔNG trả token thì login lại:
    const data = await loginApi({ email, password });
    const token = data.accessToken || data.token;
    await saveToken(token);
    set({ token, user: data.user || null });
  },

  logout: async () => {
    await removeToken();
    set({ token: null, user: null });
  },
}));
