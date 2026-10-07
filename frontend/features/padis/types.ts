export interface PadiUser {
  id: string;
  displayName: string;
  photoUrl: string | null;
  online: boolean;
  wantsToBeInvitedFor: string | null;
}

// A padi in the "View the list" directory: all your padis (online or offline),
// with rating and — only while they're sharing a fresh location — coordinates.
export interface PadiListItem {
  user: PadiUser;
  ratingAvg: number | null;
  ratingCount: number;
  latitude: number | null;
  longitude: number | null;
}

// Peer-rating data, returned on the padi profile and when submitting a rating.
export interface PadiRatingContext {
  ratingAvg: number | null;
  ratingCount: number;
  canRate: boolean;
  rateableEventId: string | null;
  myRating: number | null;
}

export interface StatusItem {
  id: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
}

export interface StatusGroup {
  user: PadiUser;
  isMe: boolean;
  hasUnseen: boolean;
  statuses: StatusItem[];
}

export interface PadiProfile extends PadiRatingContext {
  user: PadiUser;
  bio: string | null;
  location: string | null;
  memberSince: string;
  hostedCount: number;
  attendedCount: number;
  isPadi: boolean;
  isMe: boolean;
  mutualPadis: PadiUser[];
  activeStatus: { id: string; text: string | null; createdAt: string } | null;
  hostedHangouts: Array<{ id: string; title: string; startAt: string; addressText: string; goingCount: number }>;
}
