import { api } from "./apiClient";

//Dang nhap
export async function loginApi({ email, password }) {
  const res = await api.post("/api/auth/login", { email, password });
  return res.data?.data ?? res.data;
}

//Dang nhap bang Google (gui Supabase accessToken len BE)
export async function googleLoginApi({ accessToken }) {
  const res = await api.post("/api/auth/google", { accessToken });
  return res.data?.data ?? res.data;
}

//Dang ky
export async function registerApi({ name, email, password, role }) {
  const res = await api.post("/api/auth/register", { name, email, password, role });
  return res.data?.data ?? res.data; 
}

//Lay thong tin nguoi dung hien tai
export async function meApi() {
  const res = await api.get("/api/auth/me");
  return res.data?.data ?? null;
}