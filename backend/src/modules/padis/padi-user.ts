import { Prisma } from '@prisma/client';
import { isOnline } from '../../common/presence';

export interface PadiUserView {
  id: string;
  displayName: string;
  photoUrl: string | null;
  online: boolean;
  // Profile card "Wants to be invited for" — the short message on padi cards.
  wantsToBeInvitedFor: string | null;
}

export const padiUserSelect = {
  id: true,
  fullName: true,
  lastSeenAt: true,
  profile: {
    select: { displayName: true, photoUrl: true, wantsToBeInvitedFor: true },
  },
} satisfies Prisma.UserSelect;

type PadiUserRow = Prisma.UserGetPayload<{ select: typeof padiUserSelect }>;

// Falls back to the account's full name until the user sets a display name.
export function toPadiUser(user: PadiUserRow): PadiUserView {
  return {
    id: user.id,
    displayName: user.profile?.displayName ?? user.fullName,
    photoUrl: user.profile?.photoUrl ?? null,
    online: isOnline(user.lastSeenAt),
    wantsToBeInvitedFor: user.profile?.wantsToBeInvitedFor ?? null,
  };
}
