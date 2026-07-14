import { useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  fetchNotifications,
  pushNotification,
  setUnreadCount,
  setStreamConnected,
} from "../features/notifications/notificationsSlice";
import { notificationService } from "../services/notificationService";

export default function useNotificationStream(enabled = true) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!enabled) return;

    dispatch(fetchNotifications());

    const disconnect = notificationService.connectStream({
      onConnected: (data) => {
        dispatch(setStreamConnected(true));
        if (typeof data.unreadCount === "number") {
          dispatch(setUnreadCount(data.unreadCount));
        }
      },
      onNotification: (notification) => {
        dispatch(pushNotification(notification));
      },
      onError: () => {
        dispatch(setStreamConnected(false));
      },
    });

    return () => {
      dispatch(setStreamConnected(false));
      disconnect();
    };
  }, [dispatch, enabled]);
}
