import { api } from "./apiClient";

//Đăng nhập
export async function loginApi({ email, password }) {
  const res = await api.post("/api/auth/login", { email, password });
  return res.data?.data ?? res.data;
}

//Đăng nhập bằng Google (gửi Supabase accessToken lên BE)
export async function googleLoginApi({ accessToken }) {
  const res = await api.post("/api/auth/google", { accessToken });
  return res.data?.data ?? res.data;
}

//Đăng ký
export async function registerApi({ name, email, password, role }) {
  const res = await api.post("/api/auth/register", { name, email, password, role });
  return res.data?.data ?? res.data; 
}

//Lấy thông tin người dùng hiện tại
export async function meApi() {
  const res = await api.get("/api/auth/me");
  return res.data?.data ?? null;
}