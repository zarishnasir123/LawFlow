// Per-page signature status + the badge shown next to a page. The caller
// computes the status from signature_requests' page_indices + signer_role +
// status='signed'. Shared by the editor's page sidebar (DocumentPagesPanel)
// and the Submit-Case page so both render the exact same "who signed" badge.
export interface PageSignatureStatus {
  clientSigned: boolean;
  lawyerSigned: boolean;
}

// Returns the badge to show next to a page, or null when nothing is signed on
// it yet. Both signers = green; client only = amber; lawyer only = indigo.
export function deriveSignatureBadge(
  status: PageSignatureStatus | undefined
): { label: string; className: string } | null {
  if (!status) return null;
  if (status.clientSigned && status.lawyerSigned) {
    return {
      label: "Client + Lawyer Signed",
      className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    };
  }
  if (status.clientSigned) {
    return {
      label: "Client Signed",
      className: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    };
  }
  if (status.lawyerSigned) {
    return {
      label: "Lawyer Signed",
      className: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200",
    };
  }
  return null;
}
