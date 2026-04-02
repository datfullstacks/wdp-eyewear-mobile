import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  getLatestStaffMessageAt,
  getSupportTicketsApi,
  isSupportTicketUnread,
} from "../services/supportService";

const STORAGE_KEY_BASE = "support_seen_v1";

function makeStorageKey(userKey) {
  const normalized = String(userKey || "").trim();
  return normalized ? `${STORAGE_KEY_BASE}:${normalized}` : null;
}

function safeParse(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const useSupportInboxStore = create((set, get) => ({
  userKey: null,
  seenByTicketId: {},
  unreadTicketIds: [],

  setUser: async (userKey) => {
    const normalized = String(userKey || "").trim();
    if (!normalized) {
      set({
        userKey: null,
        seenByTicketId: {},
        unreadTicketIds: [],
      });
      return;
    }

    const storageKey = makeStorageKey(normalized);
    const raw = storageKey ? await AsyncStorage.getItem(storageKey) : null;

    set({
      userKey: normalized,
      seenByTicketId: safeParse(raw),
      unreadTicketIds: [],
    });
  },

  persistSeenMap: async () => {
    const { userKey, seenByTicketId } = get();
    const storageKey = makeStorageKey(userKey);
    if (!storageKey) return;
    await AsyncStorage.setItem(storageKey, JSON.stringify(seenByTicketId || {}));
  },

  updateUnreadFromTickets: (tickets = []) => {
    const seenMap = get().seenByTicketId || {};
    const unreadTicketIds = (Array.isArray(tickets) ? tickets : [])
      .filter((ticket) =>
        isSupportTicketUnread(
          ticket,
          seenMap[String(ticket?.id || ticket?._id || "").trim()] || null,
        ),
      )
      .map((ticket) => String(ticket?.id || ticket?._id || "").trim())
      .filter(Boolean);

    set({ unreadTicketIds });
    return unreadTicketIds;
  },

  refreshUnreadFromApi: async () => {
    const userKey = get().userKey;
    if (!userKey) {
      set({ unreadTicketIds: [] });
      return [];
    }

    const result = await getSupportTicketsApi({ page: 1, limit: 50 });
    const tickets = Array.isArray(result?.items) ? result.items : [];
    get().updateUnreadFromTickets(tickets);
    return tickets;
  },

  markTicketSeen: async (ticket) => {
    const ticketId = String(ticket?.id || ticket?._id || "").trim();
    if (!ticketId) return;

    const latestStaffMessageAt = getLatestStaffMessageAt(ticket);
    if (!latestStaffMessageAt) {
      set((state) => ({
        unreadTicketIds: state.unreadTicketIds.filter((id) => id !== ticketId),
      }));
      return;
    }

    set((state) => ({
      seenByTicketId: {
        ...state.seenByTicketId,
        [ticketId]: latestStaffMessageAt,
      },
      unreadTicketIds: state.unreadTicketIds.filter((id) => id !== ticketId),
    }));

    await get().persistSeenMap();
  },
}));
