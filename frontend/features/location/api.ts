import { apiRequest } from "@/lib/api/client";

export interface StateOption {
  name: string;
  code: string;
}

export function getStates(accessToken: string, countryCode: string) {
  return apiRequest<StateOption[]>(`/locations/countries/${countryCode}/states`, { method: "GET", accessToken });
}
