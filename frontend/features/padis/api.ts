import { apiRequest } from "@/lib/api/client";
import { SignedUploadParams } from "@/lib/media/cloudinary";
import { PadiListItem, PadiProfile, PadiRatingContext, PadiUser, StatusGroup, StatusItem } from "./types";

export function listPadis(accessToken: string) {
  return apiRequest<PadiUser[]>("/padis", { method: "GET", accessToken });
}

/** All your padis (online/offline) for the Padis "View the list" screen. */
export function listPadiDirectory(accessToken: string) {
  return apiRequest<PadiListItem[]>("/padis/directory", { method: "GET", accessToken });
}

export function getStatusFeed(accessToken: string) {
  return apiRequest<StatusGroup[]>("/statuses/feed", { method: "GET", accessToken });
}

export function createStatus(accessToken: string, input: { text?: string; imageUrl?: string }) {
  return apiRequest<StatusItem>("/statuses", { body: input, accessToken });
}

export function markStatusViewed(accessToken: string, statusId: string) {
  return apiRequest<{ message: string }>(`/statuses/${statusId}/view`, { method: "POST", body: {}, accessToken });
}

export function getStatusUploadSignature(accessToken: string) {
  return apiRequest<SignedUploadParams>("/statuses/upload-signature", { method: "GET", accessToken });
}

export function getPadiProfile(accessToken: string, userId: string) {
  return apiRequest<PadiProfile>(`/padis/${userId}/profile`, { method: "GET", accessToken });
}

export function addPadi(accessToken: string, userId: string) {
  return apiRequest<{ message: string }>(`/padis/${userId}`, { method: "PUT", accessToken });
}

export function removePadi(accessToken: string, userId: string) {
  return apiRequest<{ message: string }>(`/padis/${userId}`, { method: "DELETE", accessToken });
}

/** Rate a padi 1–5 stars for a hangout you both took part in. */
export function ratePadi(accessToken: string, userId: string, input: { eventId: string; stars: number }) {
  return apiRequest<PadiRatingContext>(`/padis/${userId}/rating`, { method: "POST", body: input, accessToken });
}

export function deleteStatus(accessToken: string, statusId: string) {
  return apiRequest<{ message: string }>(`/statuses/${statusId}`, { method: "DELETE", accessToken });
}
