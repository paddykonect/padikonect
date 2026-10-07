export interface Community {
  id: string;
  name: string;
  description: string;
  emoji: string;
  city: string;
  minAge: number;
  maxAge: number;
  memberCount: number;
  isMember: boolean;
  isOwner: boolean;
  conversationId: string | null;
}

export interface CreateCommunityInput {
  name: string;
  description: string;
  emoji: string;
  city?: string;
  minAge?: number;
  maxAge?: number;
}
