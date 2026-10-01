export type NotificationType = "EVENT_CANCELLED" | "EVENT_UPDATED";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
