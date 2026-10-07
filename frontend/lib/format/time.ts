// Shared display formats (Lagos-centric app, 12-hour clock like the designs).

/** "Fri, 8:00 PM" */
export function formatDayTime(iso: string | Date): string {
  const date = new Date(iso);
  const day = date.toLocaleString("en-US", { weekday: "short" });
  const time = date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}, ${time}`;
}

/** "Fri, 20 Sep · 8:00 PM" */
export function formatDateTime(iso: string | Date): string {
  const date = new Date(iso);
  const weekday = date.toLocaleString("en-US", { weekday: "short" });
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${weekday}, ${date.getDate()} ${month} · ${formatClock(date)}`;
}

/** "7:05 PM" */
export function formatClock(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Chat-list style: "2m", "3h", "Yesterday", "Mon", or "12 Sep". */
export function formatRelativeShort(iso: string | Date, now = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && date.getDate() === now.getDate()) return `${hours}h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (now.getTime() - date.getTime() < 7 * 24 * 3600 * 1000) return date.toLocaleString("en-US", { weekday: "short" });
  return date.toLocaleString("en-GB", { day: "numeric", month: "short" });
}
