import { apiRequest } from "@/lib/api/client";
import { AppNotification } from "./types";

export function listNotifications(accessToken: string) {
  return apiRequest<AppNotification[]>("/notifications", { method: "GET", accessToken });
}

export function markNotificationRead(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(`/notifications/${id}/read`, {
    method: "POST",
    accessToken,
    body: {},
  });
}
