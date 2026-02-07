import { api } from "./apiClient";

function pickData(res) {
  return res?.data?.data ?? [];
}

function pickPagination(res) {
  return res?.data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };
}

export async function getMyOrdersApi(params = {}) {
  const res = await api.get("/api/orders", { params });
  return {
    items: pickData(res),
    pagination: pickPagination(res),
  };
}

export async function getOrderByIdApi(orderId) {
  const res = await api.get(`/api/orders/${orderId}`);
  return res?.data?.data ?? null;
}
