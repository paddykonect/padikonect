import { apiRequest } from "@/lib/api/client";
import { SignedUploadParams } from "@/lib/media/cloudinary";
import { OwnProfile, PublicProfile, UpdateProfileInput } from "./types";

export function getOwnProfile(accessToken: string) {
  return apiRequest<OwnProfile>("/profiles/me", { method: "GET", accessToken });
}

export function updateOwnProfile(accessToken: string, input: UpdateProfileInput) {
  return apiRequest<OwnProfile>("/profiles/me", { method: "PATCH", body: input, accessToken });
}

export function getAvatarUploadSignature(accessToken: string) {
  return apiRequest<SignedUploadParams>("/profiles/me/avatar-upload-signature", { method: "GET", accessToken });
}

export function updateAvatar(accessToken: string, photoUrl: string) {
  return apiRequest<OwnProfile>("/profiles/me/avatar", { method: "PATCH", body: { photoUrl }, accessToken });
}

/** Another user's public profile (interests, drink preference, bio). */
export function getPublicProfile(accessToken: string, userId: string) {
  return apiRequest<PublicProfile>(`/profiles/${userId}`, { method: "GET", accessToken });
}
