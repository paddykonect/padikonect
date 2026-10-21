export interface CommunityAdmin {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
}

export interface CommunityMemberPreview {
  displayName: string | null;
  photoUrl: string | null;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  emoji: string;
  city: string;
  minAge: number;
  maxAge: number;
  coverImageUrl: string | null;
  memberCount: number;
  memberAvatars: CommunityMemberPreview[];
  isMember: boolean;
  isOwner: boolean;
  isFavorite: boolean;
  admin: CommunityAdmin | null;
  conversationId: string | null;
}

export interface CommunityChatInfo {
  conversationId: string;
  unread: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}

export interface CommunityDetail extends Community {
  vibe: string[];
  rules: string[];
  eventCount: number;
  chat: CommunityChatInfo | null;
}

export interface CommunityMember {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  role: "OWNER" | "MEMBER";
  joinedAt: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  coverImageUrl: string | null;
  emoji: string | null;
  startAt: string;
  addressText: string;
}

export interface CreateCommunityInput {
  name: string;
  description: string;
  emoji: string;
  city?: string;
  minAge?: number;
  maxAge?: number;
  coverImageUrl?: string;
  coverImagePublicId?: string;
  vibe?: string[];
  rules?: string[];
}
