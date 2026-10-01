import { apiRequest } from "@/lib/api/client";
import { OwnProfile, UpdateProfileInput } from "./types";

export function getOwnProfile(accessToken: string) {
  return apiRequest<OwnProfile>("/profiles/me", { method: "GET", accessToken });
}

export function updateOwnProfile(accessToken: string, input: UpdateProfileInput) {
  return apiRequest<OwnProfile>("/profiles/me", { method: "PATCH", body: input, accessToken });
}
