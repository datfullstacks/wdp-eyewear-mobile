import { getApiBaseUrl, normalizeBaseUrl } from "./runtimeConfig";

export function buildRealtimeUrl(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return null;
  }

  const configuredBaseUrl = normalizeBaseUrl(
    getApiBaseUrl({ required: false })
  );
  if (!configuredBaseUrl) {
    return null;
  }

  try {
    const url = new URL(configuredBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    url.searchParams.set("token", normalizedToken);
    return url.toString();
  } catch {
    return null;
  }
}

export function connectRealtime(token, handlers = {}) {
  const socketUrl = buildRealtimeUrl(token);
  if (!socketUrl) {
    return null;
  }

  const socket = new WebSocket(socketUrl);

  socket.onopen = () => {
    handlers.onOpen?.();
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event?.data || ""));
      handlers.onMessage?.(payload);
    } catch {
      // Ignore malformed payloads.
    }
  };

  socket.onerror = (error) => {
    handlers.onError?.(error);
  };

  socket.onclose = () => {
    handlers.onClose?.();
  };

  return socket;
}

export function isNotificationRealtimeEvent(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    payload.type === "notification.event" &&
    typeof payload.action === "string"
  );
}
