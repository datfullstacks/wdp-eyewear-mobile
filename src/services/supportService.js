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

export async function getSupportTicketsApi(params = {}) {
  const res = await api.get("/api/support", { params });
  return {
    items: pickData(res),
    pagination: pickPagination(res),
  };
}

export async function createSupportTicketApi(payload) {
  const res = await api.post("/api/support", payload);
  return res?.data?.data ?? null;
}

export async function replySupportTicketApi(ticketId, payload) {
  const res = await api.post(`/api/support/${ticketId}/replies`, payload);
  return res?.data?.data ?? null;
}
