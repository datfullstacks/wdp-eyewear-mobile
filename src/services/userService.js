import { api } from "./apiClient";

function pickData(res) {
  return res?.data?.data ?? res?.data ?? null;
}

// Addresses
export async function getMyAddressesApi() {
  const res = await api.get("/api/users/me/addresses");
  return pickData(res) || [];
}

export async function addMyAddressApi(payload) {
  const res = await api.post("/api/users/me/addresses", payload);
  return pickData(res) || [];
}

export async function updateMyAddressApi(addressId, payload) {
  const res = await api.put(`/api/users/me/addresses/${addressId}`, payload);
  return pickData(res) || [];
}

export async function deleteMyAddressApi(addressId) {
  const res = await api.delete(`/api/users/me/addresses/${addressId}`);
  return pickData(res) || [];
}

export async function setDefaultMyAddressApi(addressId) {
  const res = await api.put(`/api/users/me/addresses/${addressId}/default`);
  return pickData(res) || [];
}

// Favorites
export async function getMyFavoriteIdsApi() {
  const res = await api.get("/api/users/me/favorites");
  return pickData(res) || [];
}

export async function addMyFavoriteApi(productId) {
  const res = await api.post("/api/users/me/favorites", { productId });
  return pickData(res) || [];
}

export async function removeMyFavoriteApi(productId) {
  const res = await api.delete(`/api/users/me/favorites/${productId}`);
  return pickData(res) || [];
}

export async function clearMyFavoritesApi() {
  const res = await api.delete("/api/users/me/favorites");
  return pickData(res) || [];
}

// Payment methods
export async function getMyPaymentMethodsApi() {
  const res = await api.get("/api/users/me/payment-methods");
  return pickData(res) || [];
}

export async function addMyPaymentMethodApi(payload) {
  const res = await api.post("/api/users/me/payment-methods", payload);
  return pickData(res) || [];
}

export async function updateMyPaymentMethodApi(methodId, payload) {
  const res = await api.put(`/api/users/me/payment-methods/${methodId}`, payload);
  return pickData(res) || [];
}

export async function deleteMyPaymentMethodApi(methodId) {
  const res = await api.delete(`/api/users/me/payment-methods/${methodId}`);
  return pickData(res) || [];
}

export async function setDefaultMyPaymentMethodApi(methodId) {
  const res = await api.put(`/api/users/me/payment-methods/${methodId}/default`);
  return pickData(res) || [];
}

// Prescriptions
export async function getMyPrescriptionsApi() {
  const res = await api.get("/api/users/me/prescriptions");
  return pickData(res) || [];
}

export async function addMyPrescriptionApi(payload) {
  const res = await api.post("/api/users/me/prescriptions", payload);
  return pickData(res) || [];
}

export async function updateMyPrescriptionApi(prescriptionId, payload) {
  const res = await api.put(`/api/users/me/prescriptions/${prescriptionId}`, payload);
  return pickData(res) || [];
}

export async function deleteMyPrescriptionApi(prescriptionId) {
  const res = await api.delete(`/api/users/me/prescriptions/${prescriptionId}`);
  return pickData(res) || [];
}

export async function setDefaultMyPrescriptionApi(prescriptionId) {
  const res = await api.put(`/api/users/me/prescriptions/${prescriptionId}/default`);
  return pickData(res) || [];
}

// Notifications
export async function getMyNotificationsApi() {
  const res = await api.get("/api/users/me/notifications");
  return pickData(res) || [];
}

export async function markMyNotificationAsReadApi(notificationId) {
  const res = await api.put(`/api/users/me/notifications/${notificationId}/read`);
  return pickData(res) || [];
}

export async function markAllMyNotificationsAsReadApi() {
  const res = await api.put("/api/users/me/notifications/read-all");
  return pickData(res) || [];
}
