// Centralized date & time formatter for entire LawFlow

export type DateFormat =
  | "time"
  | "date"
  | "dateTime"
  | "shortDate"
  | "iso";

export function formatDate(
  value: Date | string | number,
  format: DateFormat = "dateTime"
): string {
  const date = new Date(value);

  if (isNaN(date.getTime())) return "";

  switch (format) {
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
