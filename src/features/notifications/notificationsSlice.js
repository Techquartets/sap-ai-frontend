import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { notificationService } from "../../services/notificationService";

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async (_, { rejectWithValue }) => {
    try {
      return await notificationService.fetchNotifications();
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load notifications"
      );
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  "notifications/markRead",
  async (notificationId, { rejectWithValue }) => {
    try {
      await notificationService.markRead(notificationId);
      return notificationId;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to mark notification as read"
      );
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await notificationService.markAllRead();
      return true;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to mark all as read"
      );
    }
  }
);

export const deleteNotification = createAsyncThunk(
  "notifications/delete",
  async (notificationId, { rejectWithValue }) => {
    try {
      const result = await notificationService.deleteNotification(notificationId);
      return { notificationId, wasUnread: result.wasUnread };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to delete notification"
      );
    }
  }
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: {
    items: [],
    unreadCount: 0,
    loading: false,
    error: null,
    toast: null,
    streamConnected: false,
  },
  reducers: {
    pushNotification: (state, action) => {
      const exists = state.items.some((n) => n.id === action.payload.id);
      if (exists) return;
      state.items.unshift(action.payload);
      if (!action.payload.read) {
        state.unreadCount += 1;
      }
      state.toast = action.payload;
    },
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },
    clearToast: (state) => {
      state.toast = null;
    },
    setStreamConnected: (state, action) => {
      state.streamConnected = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.notifications || [];
        state.unreadCount = action.payload.unreadCount || 0;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const id = action.payload;
        const item = state.items.find((n) => n.id === id);
        if (item && !item.read) {
          item.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((n) => ({ ...n, read: true }));
        state.unreadCount = 0;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const { notificationId, wasUnread } = action.payload;
        state.items = state.items.filter((n) => n.id !== notificationId);
        if (wasUnread) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        if (state.toast?.id === notificationId) {
          state.toast = null;
        }
      });
  },
});

export const {
  pushNotification,
  setUnreadCount,
  clearToast,
  setStreamConnected,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
