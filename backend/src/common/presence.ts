// Presence: a user counts as "online" when their lastSeenAt was refreshed
// within this window. PresenceInterceptor bumps lastSeenAt (throttled) on every
// authenticated request, so "online" means "made an app request in the last
// few minutes".
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

export function isOnline(lastSeenAt: Date | null | undefined): boolean {
  return !!lastSeenAt && lastSeenAt.getTime() > Date.now() - PRESENCE_WINDOW_MS;
}
