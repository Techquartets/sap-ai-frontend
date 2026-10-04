import apiClient from "./apiClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const notificationService = {
  fetchNotifications: async () => {
    const response = await apiClient.get("/sap/notifications/");
    return response.data;
  },

  markRead: async (notificationId) => {
    const response = await apiClient.patch(
      `/sap/notifications/${notificationId}/read/`
    );
    return response.data;
  },

  markAllRead: async () => {
    const response = await apiClient.patch("/sap/notifications/read-all/");
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await apiClient.delete(
      `/sap/notifications/${notificationId}/`
    );
    return response.data;
  },

  connectStream: (handlers = {}) => {
    const url = `${API_BASE_URL}/sap/notifications/stream/`;
    const source = new EventSource(url, { withCredentials: true });

    source.addEventListener("connected", (event) => {
      try {
        const data = JSON.parse(event.data);
        handlers.onConnected?.(data);
      } catch {
        handlers.onConnected?.({});
      }
    });

    source.addEventListener("notification", (event) => {
      try {
        const data = JSON.parse(event.data);
        handlers.onNotification?.(data);
      } catch {
        /* ignore malformed payloads */
      }
    });

    source.onerror = () => {
      handlers.onError?.();
    };

    return () => {
      source.close();
    };
  },
};
