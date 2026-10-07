const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The value encoded in a padi's QR code: a link that opens their profile. */
export function padiLink(userId: string): string {
  return `${window.location.origin}/padi/${userId}`;
}

/** Accepts a scanned/pasted padi link (or a bare user id) and returns the user id. */
export function parsePadiCode(raw: string): string | null {
  const text = raw.trim();
  const fromLink = text.match(/\/padi\/([0-9a-f-]{36})/i);
  if (fromLink && UUID.test(fromLink[1])) return fromLink[1].toLowerCase();
  const bare = text.match(UUID);
  return bare && bare[0].length === text.length ? bare[0].toLowerCase() : null;
}
