import { api } from "./apiClient";

export async function loginApi({ email, password }) {
  // Sửa endpoint cho đúng API của bạn
  const res = await api.post("/api/auth/login", { email, password });
  return res.data; // ví dụ: { accessToken, user }
}

export async function registerApi({ name, email, password }) {
  // đổi endpoint cho đúng API bạn
  const res = await api.post("/api/auth/register", { name, email, password, role });
  return res.data; // có thể trả { token, user } hoặc chỉ message
}