import { api } from "./apiClient";

export async function validatePromotionApi(payload) {
  const res = await api.post("/api/promotions/validate", payload);
  return res?.data?.data || res?.data || {};
}
