import { api } from "./apiClient";

function mapStore(raw = {}) {
  return {
    id: String(raw?._id || raw?.id || ""),
    name: String(raw?.name || "").trim(),
    code: String(raw?.code || "").trim(),
    status: String(raw?.status || "active").trim().toLowerCase(),
    type: String(raw?.type || "branch").trim().toLowerCase(),
    phone: String(raw?.phone || "").trim(),
    email: String(raw?.email || "").trim(),
    addressLine1: String(raw?.addressLine1 || "").trim(),
    ward: String(raw?.ward || "").trim(),
    district: String(raw?.district || "").trim(),
    city: String(raw?.city || "").trim(),
    openingHours: String(raw?.openingHours || "").trim(),
    note: String(raw?.note || "").trim(),
    supportsTryOn: Boolean(raw?.supportsTryOn),
    supportsPickup: raw?.supportsPickup !== false,
    isDefault: Boolean(raw?.isDefault),
  };
}

export async function fetchStores(params = {}) {
  const res = await api.get("/api/stores", {
    params: {
      page: params.page || 1,
      limit: params.limit || 100,
      status: params.status || "active",
      search: params.search || undefined,
    },
  });

  const rows = Array.isArray(res?.data?.data)
    ? res.data.data
    : Array.isArray(res?.data?.stores)
      ? res.data.stores
      : [];

  return rows.map(mapStore).filter((store) => store.id);
}
