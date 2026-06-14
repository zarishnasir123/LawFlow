// Centralized date & time formatter for entire LawFlow

export type DateFormat =
  | "time"
  | "date"
  | "dateTime"
  | "shortDate"
  | "iso"
  | "relative";

export function formatDate(
  value: Date | string | number,
  format: DateFormat = "dateTime"
): string {
  const date = new Date(value);

  if (isNaN(date.getTime())) return "";

  switch (format) {
    // Human "time ago" rendering for activity feeds: "Just now",
    // "3 hours ago", "2 days ago". Anything older than a week falls back to
    // the plain "date" format so a feed item never reads "53 days ago".
    case "relative": {
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60)
        return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
      if (diffHours < 24)
        return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
      if (diffDays < 7)
        return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

      return formatDate(date, "date");
    }

    case "time":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

    case "date":
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    case "shortDate":
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "numeric",
        year: "2-digit",
      });

    case "iso":
      return date.toISOString();

    case "dateTime":
    default:
      return (
        date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }) +
        " " +
        date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
  }
}
