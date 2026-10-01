export type DrinkPreference = "ALCOHOLIC" | "NON_ALCOHOLIC" | "BOTH";

export interface OwnProfile {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  bio: string | null;
  drinkPreference: DrinkPreference;
  interests: string[];
  country: string | null;
  nationality: string | null;
  state: string | null;
  membershipStatus: "FREE" | "PREMIUM";
  padiPoints: number;
  hostedCount: number;
  attendedCount: number;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  drinkPreference?: DrinkPreference;
  interests?: string[];
  country?: string;
  nationality?: string;
  state?: string;
}
