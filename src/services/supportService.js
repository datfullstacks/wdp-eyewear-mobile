import { api } from "./apiClient";
import { normalizeSupportAttachments } from "./supportMediaService";

export const SUPPORT_CATEGORY_META = Object.freeze({
  general: { label: "Chung", bg: "#F3F4F6", fg: "#374151" },
  order: { label: "Đơn hàng", bg: "#EFF6FF", fg: "#1D4ED8" },
  prescription: { label: "Đơn thuốc", bg: "#EEF2FF", fg: "#4338CA" },
  shipping: { label: "Giao hàng", bg: "#ECFEFF", fg: "#0F766E" },
  refund: { label: "Hoàn tiền", bg: "#FEF3C7", fg: "#B45309" },
  return: { label: "Trả hàng", bg: "#FCE7F3", fg: "#BE185D" },
  warranty: { label: "Bảo hành", bg: "#ECFDF5", fg: "#15803D" },
});

export const SUPPORT_STATUS_META = Object.freeze({
  open: { label: "Mới tạo", bg: "#F3F4F6", fg: "#374151" },
  in_progress: { label: "Đang xử lý", bg: "#EFF6FF", fg: "#1D4ED8" },
  resolved: { label: "Đã giải quyết", bg: "#ECFDF5", fg: "#15803D" },
  closed: { label: "Đã đóng", bg: "#F3F4F6", fg: "#6B7280" },
  requested: { label: "Đã gửi yêu cầu", bg: "#FFF7ED", fg: "#B45309" },
  under_review: { label: "Đang xem xét", bg: "#EFF6FF", fg: "#1D4ED8" },
  approved: { label: "Đã duyệt", bg: "#ECFDF5", fg: "#15803D" },
  rejected: { label: "Từ chối", bg: "#FEE2E2", fg: "#991B1B" },
  in_service: { label: "Đang bảo hành", bg: "#ECFEFF", fg: "#0F766E" },
  completed: { label: "Hoàn tất", bg: "#ECFDF5", fg: "#15803D" },
});

const DEFAULT_CATEGORY_META = SUPPORT_CATEGORY_META.general;
const DEFAULT_STATUS_META = SUPPORT_STATUS_META.open;

function pickData(res) {
  return res?.data?.data ?? [];
}

function pickPagination(res) {
  return (
    res?.data?.pagination || {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    }
  );
}

function toText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function toId(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object") {
    return toText(value?._id || value?.id, "");
  }
  return "";
}

function normalizeMessage(raw = {}) {
  return {
    sender: toText(raw?.sender || "user", "user").toLowerCase(),
    message: toText(raw?.message, ""),
    attachments: normalizeSupportAttachments(raw?.attachments),
    createdAt: raw?.createdAt || null,
  };
}

export function getLatestSupportMessage(ticket) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  return messages.length ? messages[messages.length - 1] : null;
}

export function getLatestStaffMessage(ticket) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (toText(message?.sender, "").toLowerCase() === "staff") {
      return message;
    }
  }
  return null;
}

export function getLatestStaffMessageAt(ticket) {
  return getLatestStaffMessage(ticket)?.createdAt || null;
}

export function isSupportTicketUnread(ticket, seenAt) {
  const latestMessage = getLatestSupportMessage(ticket);
  if (!latestMessage) return false;

  const latestSender = toText(latestMessage?.sender, "").toLowerCase();
  if (latestSender !== "staff") return false;

  const latestTime = new Date(latestMessage?.createdAt || 0).getTime();
  if (!Number.isFinite(latestTime) || latestTime <= 0) return false;

  const seenTime = new Date(seenAt || 0).getTime();
  return !Number.isFinite(seenTime) || seenTime < latestTime;
}

function normalizeOrderRef(raw) {
  if (!raw) return null;
  const id = toId(raw);
  if (!id) return null;

  if (typeof raw !== "object") {
    return {
      id,
      paymentCode: "",
      status: "",
      orderType: "",
      createdAt: null,
    };
  }

  return {
    id,
    paymentCode: toText(raw?.paymentCode, ""),
    status: toText(raw?.status, ""),
    orderType: toText(raw?.orderType, ""),
    createdAt: raw?.createdAt || null,
  };
}

function normalizeStoreRef(raw) {
  if (!raw) return null;
  const id = toId(raw);
  if (!id) return null;

  if (typeof raw !== "object") {
    return {
      id,
      name: "",
      code: "",
      type: "",
      status: "",
      city: "",
      district: "",
    };
  }

  return {
    id,
    name: toText(raw?.name, ""),
    code: toText(raw?.code, ""),
    type: toText(raw?.type, ""),
    status: toText(raw?.status, ""),
    city: toText(raw?.city, ""),
    district: toText(raw?.district, ""),
  };
}

function normalizeWarranty(raw = {}) {
  if (!raw || typeof raw !== "object") return null;

  const productId = toId(raw?.productId);
  const variantId = toId(raw?.variantId);
  const orderItemId = toId(raw?.orderItemId);

  return {
    orderItemId,
    productId,
    variantId,
    itemName: toText(raw?.itemName, ""),
    warrantyMonths: Number(raw?.warrantyMonths || 0),
    referenceDate: raw?.referenceDate || null,
    expiresAt: raw?.expiresAt || null,
    eligibility: toText(raw?.eligibility, "").toLowerCase(),
    decisionNote: toText(raw?.decisionNote, ""),
    serviceNote: toText(raw?.serviceNote, ""),
    approvedBy: toId(raw?.approvedBy),
    approvedAt: raw?.approvedAt || null,
    completedBy: toId(raw?.completedBy),
    completedAt: raw?.completedAt || null,
  };
}

export function normalizeSupportTicket(raw = {}) {
  const id = toId(raw?._id || raw?.id);
  const category = toText(raw?.category, "general").toLowerCase();
  const status = toText(raw?.status, "open").toLowerCase();
  const messages = Array.isArray(raw?.messages)
    ? raw.messages.map(normalizeMessage)
    : [];
  const latestMessage =
    messages.length > 0 ? messages[messages.length - 1]?.message || "" : "";

  return {
    id,
    _id: id,
    subject: toText(raw?.subject, ""),
    email: toText(raw?.email, ""),
    category,
    categoryMeta: SUPPORT_CATEGORY_META[category] || DEFAULT_CATEGORY_META,
    status,
    statusMeta: SUPPORT_STATUS_META[status] || DEFAULT_STATUS_META,
    priority: toText(raw?.priority, "normal").toLowerCase(),
    order: normalizeOrderRef(raw?.orderId),
    store: normalizeStoreRef(raw?.storeId),
    warranty: normalizeWarranty(raw?.warranty),
    messages,
    latestMessage,
    lastMessageAt: raw?.lastMessageAt || raw?.updatedAt || null,
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
  };
}

export function isWarrantyTicket(ticket) {
  return toText(ticket?.category, "").toLowerCase() === "warranty";
}

export async function getSupportTicketsApi(params = {}) {
  const res = await api.get("/api/support", { params });
  const items = Array.isArray(pickData(res)) ? pickData(res) : [];
  return {
    items: items.map(normalizeSupportTicket),
    pagination: pickPagination(res),
  };
}

export async function getSupportTicketByIdApi(ticketId) {
  const res = await api.get(`/api/support/${ticketId}`);
  return normalizeSupportTicket(res?.data?.data ?? null);
}

export async function createSupportTicketApi(payload) {
  const res = await api.post("/api/support", payload);
  return normalizeSupportTicket(res?.data?.data ?? null);
}

export async function replySupportTicketApi(ticketId, payload) {
  const res = await api.post(`/api/support/${ticketId}/replies`, payload);
  return normalizeSupportTicket(res?.data?.data ?? null);
}
