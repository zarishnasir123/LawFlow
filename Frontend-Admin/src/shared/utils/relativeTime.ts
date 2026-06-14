// Turns an ISO timestamp into a short relative label ("just now",
// "2 hours ago", "3 days ago"). Used by the admin dashboard panels where the
// design calls for a friendly "applied 2 hours ago" style caption rather than
// an absolute date. Falls back to the original string for unparseable input so
// the UI never renders "Invalid Date".
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "";

  const date = new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return value;

  const diffSeconds = Math.round((Date.now() - ms) / 1000);

  // Future timestamps (clock skew) collapse to "just now" rather than a
  // negative "in -3 seconds" label.
  if (diffSeconds < 45) return "just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.round(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}
