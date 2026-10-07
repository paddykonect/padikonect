import { apiRequest } from "@/lib/api/client";
import { Community, CreateCommunityInput } from "./types";

export function listCommunities(accessToken: string, mine = false) {
  return apiRequest<Community[]>(`/communities${mine ? "?mine=true" : ""}`, { method: "GET", accessToken });
}

export function createCommunity(accessToken: string, input: CreateCommunityInput) {
  return apiRequest<Community>("/communities", { body: input, accessToken });
}

export function joinCommunity(accessToken: string, id: string) {
  return apiRequest<Community>(`/communities/${id}/join`, { method: "POST", body: {}, accessToken });
}

export function leaveCommunity(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(`/communities/${id}/membership`, { method: "DELETE", accessToken });
}
