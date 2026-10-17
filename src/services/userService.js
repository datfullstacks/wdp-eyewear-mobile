import { api } from "./apiClient";

function pickData(res) {
  return res?.data?.data ?? res?.data ?? null;
}

// Lấy địa chỉ
export async function getMyAddressesApi() {
  const res = await api.get("/api/users/me/addresses");
  return pickData(res) || [];
}

//Thêm địa chỉ
export async function addMyAddressApi(payload) {
  const res = await api.post("/api/users/me/addresses", payload);
  return pickData(res) || [];
}

//Cập nhật địa chỉ
export async function updateMyAddressApi(addressId, payload) {
  const res = await api.put(`/api/users/me/addresses/${addressId}`, payload);
  return pickData(res) || [];
}

//Xóa địa chỉ
export async function deleteMyAddressApi(addressId) {
  const res = await api.delete(`/api/users/me/addresses/${addressId}`);
  return pickData(res) || [];
}

//Thiết lập địa chỉ mặt định
export async function setDefaultMyAddressApi(addressId) {
  const res = await api.put(`/api/users/me/addresses/${addressId}/default`);
  return pickData(res) || [];
}

//Lấy sp yêu thích
export async function getMyFavoriteIdsApi() {
  const res = await api.get("/api/users/me/favorites");
  return pickData(res) || [];
}

//Thêm sp yêu thích
export async function addMyFavoriteApi(productId) {
  const res = await api.post("/api/users/me/favorites", { productId });
  return pickData(res) || [];
}

//Xóa sp yêu thích bằng id
export async function removeMyFavoriteApi(productId) {
  const res = await api.delete(`/api/users/me/favorites/${productId}`);
  return pickData(res) || [];
}

//Xóa tất cả sp yêu thích
export async function clearMyFavoritesApi() {
  const res = await api.delete("/api/users/me/favorites");
  return pickData(res) || [];
}

//Lây phương thức thanh toán
export async function getMyPaymentMethodsApi() {
  const res = await api.get("/api/users/me/payment-methods");
  return pickData(res) || [];
}

//Thêm phương thức thanh toán
export async function addMyPaymentMethodApi(payload) {
  const res = await api.post("/api/users/me/payment-methods", payload);
  return pickData(res) || [];
}

//Cập nhật phương thức thanh toán
export async function updateMyPaymentMethodApi(methodId, payload) {
  const res = await api.put(
    `/api/users/me/payment-methods/${methodId}`,
    payload,
  );
  return pickData(res) || [];
}

//Xóa phương thức thanh toán
export async function deleteMyPaymentMethodApi(methodId) {
  const res = await api.delete(`/api/users/me/payment-methods/${methodId}`);
  return pickData(res) || [];
}

//Thiết lập phương thức thanh toán mặt định
export async function setDefaultMyPaymentMethodApi(methodId) {
  const res = await api.put(
    `/api/users/me/payment-methods/${methodId}/default`,
  );
  return pickData(res) || [];
}

export async function getMyRefundAccountApi() {
  const res = await api.get("/api/users/me/refund-account");
  return pickData(res) || null;
}

export async function upsertMyRefundAccountApi(payload) {
  const res = await api.put("/api/users/me/refund-account", payload);
  return pickData(res) || null;
}

export async function deleteMyRefundAccountApi() {
  const res = await api.delete("/api/users/me/refund-account");
  return pickData(res) || null;
}

//Lấy Prescriptions
export async function getMyPrescriptionsApi() {
  const res = await api.get("/api/users/me/prescriptions");
  return pickData(res) || [];
}

//Thêm Prescription
export async function addMyPrescriptionApi(payload) {
  const res = await api.post("/api/users/me/prescriptions", payload);
  return pickData(res) || [];
}

//Cập nhật Prescription
export async function updateMyPrescriptionApi(prescriptionId, payload) {
  const res = await api.put(
    `/api/users/me/prescriptions/${prescriptionId}`,
    payload,
  );
  return pickData(res) || [];
}

//Xóa Prescription
export async function deleteMyPrescriptionApi(prescriptionId) {
  const res = await api.delete(`/api/users/me/prescriptions/${prescriptionId}`);
  return pickData(res) || [];
}

//Thiết lập Prescription mặt định
export async function setDefaultMyPrescriptionApi(prescriptionId) {
  const res = await api.put(
    `/api/users/me/prescriptions/${prescriptionId}/default`,
  );
  return pickData(res) || [];
}

//Lấy Notifications
export async function getMyNotificationsApi() {
  const res = await api.get("/api/users/me/notifications");
  return pickData(res) || [];
}

//Đánh dấu Notifications đã đọc
export async function markMyNotificationAsReadApi(notificationId) {
  const res = await api.put(
    `/api/users/me/notifications/${notificationId}/read`,
  );
  return pickData(res) || [];
}

//Đánh dấu tất cả Notifications đã đọc
export async function markAllMyNotificationsAsReadApi() {
  const res = await api.put("/api/users/me/notifications/read-all");
  return pickData(res) || [];
}

export async function registerMyPushTokenApi(payload, authToken) {
  const res = await api.post("/api/users/me/push-tokens", payload, {
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined,
  });
  return pickData(res) || [];
}

export async function unregisterMyPushTokenApi(token, authToken) {
  const res = await api.delete("/api/users/me/push-tokens", {
    data: { token },
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined,
  });
  return pickData(res) || [];
}
