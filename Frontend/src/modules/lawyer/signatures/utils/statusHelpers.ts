import type {
  SignatureRequestStatus,
} from "../api/signatures.api";

// Status badge styling for both the lawyer editor's signature panel and
// the client dashboard's pending list. Keeping the color decisions in
// one place means new statuses (e.g., expired) get consistent visuals
// across the app.
export function getStatusBadgeClasses(status: SignatureRequestStatus): {
  bg: string;
  text: string;
  label: string;
} {
  switch (status) {
    case "signed":
      return { bg: "bg-emerald-100", text: "text-emerald-800", label: "Signed" };
    case "pending":
      return { bg: "bg-amber-100", text: "text-amber-800", label: "Pending" };
    case "expired":
      return { bg: "bg-gray-100", text: "text-gray-600", label: "Expired" };
    case "cancelled":
      return { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" };
  }
}

export function formatSignatureDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
