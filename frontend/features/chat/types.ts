import { PadiUser } from "@/features/padis/types";

export interface Conversation {
  id: string;
  type: "DIRECT" | "EVENT" | "COMMUNITY";
  title: string;
  imageUrl: string | null;
  emoji: string | null;
  subtitle: string;
  eventId: string | null;
  otherUserId: string | null;
  memberCount: number;
  lastMessage: { body: string; createdAt: string; senderId: string } | null;
  unread: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  clientId: string;
  body: string;
  createdAt: string;
  sender: PadiUser;
}
