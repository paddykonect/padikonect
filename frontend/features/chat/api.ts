import { apiRequest } from "@/lib/api/client";
import { ChatMessage, Conversation } from "./types";

export function listConversations(accessToken: string) {
  return apiRequest<Conversation[]>("/conversations", { method: "GET", accessToken });
}

export function getConversation(accessToken: string, id: string) {
  return apiRequest<Conversation>(`/conversations/${id}`, { method: "GET", accessToken });
}

export function openDirect(accessToken: string, userId: string) {
  return apiRequest<Conversation>("/conversations/direct", { body: { userId }, accessToken });
}

export function listMessages(accessToken: string, id: string, before?: string) {
  const qs = before ? `?before=${before}` : "";
  return apiRequest<{ items: ChatMessage[]; hasMore: boolean }>(`/conversations/${id}/messages${qs}`, { method: "GET", accessToken });
}

export function sendMessage(accessToken: string, id: string, body: string, clientId: string) {
  return apiRequest<ChatMessage>(`/conversations/${id}/messages`, { body: { body, clientId }, accessToken });
}

export function markRead(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(`/conversations/${id}/read`, { body: {}, accessToken });
}
