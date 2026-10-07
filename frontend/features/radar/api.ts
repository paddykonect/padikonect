import { apiRequest } from "@/lib/api/client";
import { PadiUser } from "@/features/padis/types";

export interface RadarStatus {
  sharing: boolean;
  updatedAt: string | null;
}

export interface RadarPadi {
  user: PadiUser;
  latitude: number;
  longitude: number;
  updatedAt: string;
  ratingAvg: number | null;
  ratingCount: number;
  // Whether you've added this padi back (drives "Add padi" vs "Padis").
  isPadi: boolean;
  // Whether you've hidden yourself from this padi (the eye toggle state).
  hiddenFromThem: boolean;
}

export function getRadarStatus(accessToken: string) {
  return apiRequest<RadarStatus>("/radar/me", { method: "GET", accessToken });
}

export function shareLocation(accessToken: string, latitude: number, longitude: number) {
  return apiRequest<RadarStatus>("/radar/me", { method: "PUT", body: { latitude, longitude }, accessToken });
}

export function stopSharing(accessToken: string) {
  return apiRequest<RadarStatus>("/radar/me", { method: "DELETE", accessToken });
}

export function listRadarPadis(accessToken: string) {
  return apiRequest<RadarPadi[]>("/radar/padis", { method: "GET", accessToken });
}

/** Hide yourself from this padi (radar + profile) via the eye toggle. */
export function hidePadi(accessToken: string, userId: string) {
  return apiRequest<{ hidden: boolean }>(`/radar/hide/${userId}`, { method: "POST", body: {}, accessToken });
}

export function unhidePadi(accessToken: string, userId: string) {
  return apiRequest<{ hidden: boolean }>(`/radar/hide/${userId}`, { method: "DELETE", accessToken });
}
