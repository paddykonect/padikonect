export type DrinkPreference = "ALCOHOLIC" | "NON_ALCOHOLIC" | "BOTH";
export type InvitePolicy = "EVERYONE" | "PADIS_ONLY" | "NO_ONE";

export interface ProfilePhoto {
  url: string;
  publicId: string | null;
  position: number;
}

export interface OwnProfile {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  photos: ProfilePhoto[];
  bio: string | null;
  age: number | null;
  showAge: boolean;
  drinkPreference: DrinkPreference;
  interests: string[];
  vibe: string[];
  invitePlans: string[];
  wantsToBeInvitedFor: string | null;
  country: string | null;
  nationality: string | null;
  state: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  invitePolicy: InvitePolicy;
  pushNotifications: boolean;
  locationServices: boolean;
  radarDiscoverable: boolean;
  membershipStatus: "FREE" | "PREMIUM";
  padiPoints: number;
  hostedCount: number;
  attendedCount: number;
  padiCount: number;
}

/** What other padis can see (GET /profiles/:userId). */
export type PublicProfile = Pick<
  OwnProfile,
  "id" | "displayName" | "photoUrl" | "photos" | "bio" | "age" | "drinkPreference" | "interests" | "vibe" | "wantsToBeInvitedFor" | "membershipStatus" | "hostedCount" | "attendedCount" | "padiCount"
>;

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  drinkPreference?: DrinkPreference;
  interests?: string[];
  vibe?: string[];
  invitePlans?: string[];
  photos?: { url: string; publicId?: string }[];
  showAge?: boolean;
  wantsToBeInvitedFor?: string;
  country?: string;
  nationality?: string;
  state?: string;
  phone?: string;
  invitePolicy?: InvitePolicy;
  pushNotifications?: boolean;
  locationServices?: boolean;
  radarDiscoverable?: boolean;
}

export const DRINK_PREFERENCE_LABEL: Record<DrinkPreference, string> = {
  BOTH: "Both",
  ALCOHOLIC: "Alcoholic",
  NON_ALCOHOLIC: "Non-alcoholic",
};
