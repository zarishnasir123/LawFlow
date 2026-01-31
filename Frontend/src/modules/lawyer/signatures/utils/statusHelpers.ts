export function getSignatureStatus(clientSigned: boolean): {
  status: "pending" | "completed";
  label: string;
  color: "amber" | "emerald";
} {
  if (clientSigned) {
    return {
      status: "completed",
      label: "Signed",
      color: "emerald",
    };
  }

  return {
    status: "pending",
    label: "Pending Client",
    color: "amber",
  };
}

export function getStatusBadgeClasses(color: "amber" | "emerald"): {
  bg: string;
  text: string;
} {
  switch (color) {
    case "amber":
      return {
        bg: "bg-amber-100",
        text: "text-amber-800",
      };
    case "emerald":
      return {
        bg: "bg-emerald-100",
        text: "text-emerald-800",
      };
  }
}

export function getDocTypeLabel(docType: "DOC" | "ATTACHMENT"): string {
  return docType === "DOC" ? "Document" : "Attachment";
}

export function formatSignatureDate(dateString: string | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
