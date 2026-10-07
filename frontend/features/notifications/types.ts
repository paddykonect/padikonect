export type NotificationType =
  | "EVENT_CANCELLED"
  | "EVENT_UPDATED"
  | "EVENT_INVITE"
  | "RSVP_REQUESTED"
  | "RSVP_APPROVED"
  | "RSVP_DECLINED"
  | "VENUE_CONFIRMED"
  | "VENUE_REJECTED"
  | "VENUE_REQUEST";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
