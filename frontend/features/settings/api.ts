import { PadiUser } from "@/features/padis/types";
import { apiRequest } from "@/lib/api/client";

export type SupportTopic = "HANGOUTS" | "REWARDS" | "REPORT_PADI" | "OTHER";

export interface BlockedUser {
  user: PadiUser;
  blockedAt: string;
}

export function changePassword(accessToken: string, input: { currentPassword: string; newPassword: string }) {
  return apiRequest<{ accessToken: string }>("/account/password", { method: "POST", body: input, accessToken });
}

/** Step 1: emails a code; nothing is saved until it's verified. */
export function requestContactChange(accessToken: string, input: { email?: string; phone?: string }) {
  return apiRequest<{ sentTo: string }>("/account/contact-change", { method: "POST", body: input, accessToken });
}

export function resendContactChange(accessToken: string) {
  return apiRequest<{ sentTo: string }>("/account/contact-change/resend", { method: "POST", accessToken });
}

export function verifyContactChange(accessToken: string, code: string) {
  return apiRequest<{ email: string; phone: string | null }>("/account/contact-change/verify", {
    method: "POST",
    body: { code },
    accessToken,
  });
}

export function deleteAccount(accessToken: string) {
  return apiRequest<{ message: string }>("/account", { method: "DELETE", body: { confirm: true }, accessToken });
}

export function listBlocked(accessToken: string) {
  return apiRequest<BlockedUser[]>("/blocks", { method: "GET", accessToken });
}

export function blockUser(accessToken: string, userId: string) {
  return apiRequest<{ message: string }>(`/blocks/${userId}`, { method: "PUT", accessToken });
}

export function unblockUser(accessToken: string, userId: string) {
  return apiRequest<{ message: string }>(`/blocks/${userId}`, { method: "DELETE", accessToken });
}

export function sendSupportMessage(accessToken: string, input: { topic: SupportTopic; message: string }) {
  return apiRequest<{ id: string }>("/support/messages", { method: "POST", body: input, accessToken });
}
