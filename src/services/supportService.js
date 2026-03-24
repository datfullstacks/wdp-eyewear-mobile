import { api } from "./apiClient";

export const SUPPORT_CATEGORY_META = Object.freeze({
  general: { label: "Chung", bg: "#F3F4F6", fg: "#374151" },
  order: { label: "Don hang", bg: "#EFF6FF", fg: "#1D4ED8" },
  prescription: { label: "Prescription", bg: "#EEF2FF", fg: "#4338CA" },
  shipping: { label: "Giao hang", bg: "#ECFEFF", fg: "#0F766E" },
  refund: { label: "Refund", bg: "#FEF3C7", fg: "#B45309" },
  return: { label: "Tra hang", bg: "#FCE7F3", fg: "#BE185D" },
  warranty: { label: "Bao hanh", bg: "#ECFDF5", fg: "#15803D" },
});

export const SUPPORT_STATUS_META = Object.freeze({
  open: { label: "Moi tao", bg: "#F3F4F6", fg: "#374151" },
  in_progress: { label: "Dang xu ly", bg: "#EFF6FF", fg: "#1D4ED8" },
  resolved: { label: "Da giai quyet", bg: "#ECFDF5", fg: "#15803D" },
  closed: { label: "Da dong", bg: "#F3F4F6", fg: "#6B7280" },
  requested: { label: "Da gui yeu cau", bg: "#FFF7ED", fg: "#B45309" },
  under_review: { label: "Dang review", bg: "#EFF6FF", fg: "#1D4ED8" },
  approved: { label: "Da duyet", bg: "#ECFDF5", fg: "#15803D" },
  rejected: { label: "Tu choi", bg: "#FEE2E2", fg: "#991B1B" },
  in_service: { label: "Dang bao hanh", bg: "#ECFEFF", fg: "#0F766E" },
  completed: { label: "Hoan tat", bg: "#ECFDF5", fg: "#15803D" },
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
    createdAt: raw?.createdAt || null,
  };
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
