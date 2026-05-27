import {
  cancelSignatureRequest,
  createSignatureRequestBatch,
  getSignatureRequestForSigner,
  getSignedCasePdfDownload,
  isCaseFullySigned,
  listHistoryForRecipient,
  listPendingForRecipient,
  listSignatureRequestsForCase,
  saveEditedDocument,
  submitSignature,
} from "./signatures.service.js";

// =====================================================================
// Lawyer-auth endpoints (mounted under /api/cases/:caseId)
// =====================================================================

// Lawyer saves the current edited HTML state of a case document.
// Frontend calls this on Save Draft (manual) and on a debounced interval
// while editing. Body: { editedHtml: string }.
export async function putEditedDocument(req, res) {
  const { caseId } = req.params;
  const { editedHtml } = req.body;
  const result = await saveEditedDocument({
    caseId,
    lawyerUserId: req.user.sub,
    editedHtml,
  });
  return res.status(200).json(result);
}

// Lawyer creates a batch of signature requests in one "Send" action.
// Body shape:
//   {
//     clientEmail: "client@example.com",
//     pageAssignments: [
//       { pageIndex: 0, signers: ["client"] },
//       { pageIndex: 3, signers: ["client", "lawyer"] }
//     ]
//   }
// Returns: { batchId, signatureRequests: [...] }
export async function postSignatureRequest(req, res) {
  const { caseId } = req.params;
  const { clientEmail, pageAssignments, documentHtmlSnapshot } = req.body;

  const { batchId, requests } = await createSignatureRequestBatch({
    caseId,
    lawyerUserId: req.user.sub,
    clientEmail: clientEmail?.trim().toLowerCase(),
    pageAssignments,
    documentHtmlSnapshot,
  });

  return res.status(201).json({
    batchId,
    signatureRequests: requests,
  });
}

// Lawyer lists every signature request on a case + the rolled-up
// "is everything signed?" state. The editor sidebar polls this every
// few seconds while open.
export async function getCaseSignatureRequests(req, res) {
  const { caseId } = req.params;
  const requests = await listSignatureRequestsForCase({
    caseId,
    lawyerUserId: req.user.sub,
  });
  const completion = await isCaseFullySigned({
    caseId,
    lawyerUserId: req.user.sub,
  });
  return res.status(200).json({ signatureRequests: requests, completion });
}

// Lawyer requests a short-lived download URL for the compiled signed
// PDF. Returns 409 if the case isn't fully signed yet so the lawyer
// editor can suppress the button in that state.
export async function getSignedPdfDownloadUrl(req, res) {
  const { caseId } = req.params;
  const result = await getSignedCasePdfDownload({
    caseId,
    lawyerUserId: req.user.sub,
  });
  return res.status(200).json(result);
}

// Lawyer cancels a request before signing happens.
export async function deleteSignatureRequest(req, res) {
  const { requestId } = req.params;
  const updated = await cancelSignatureRequest({
    requestId,
    lawyerUserId: req.user.sub,
  });
  return res.status(200).json({ signatureRequest: updated });
}

// =====================================================================
// Recipient-auth endpoints (mounted under /api/me — works for both
// client and lawyer recipients, since each row has exactly one signer)
// =====================================================================

// "What signatures am I asked to provide?" — drives both the client
// dashboard's Pending Signatures view and the lawyer's "self-sign"
// inbox. Filters server-side to status='pending' AND not expired.
export async function getMyPendingSignatures(req, res) {
  const requests = await listPendingForRecipient({ userId: req.user.sub });
  return res.status(200).json({ signatureRequests: requests });
}

// "What happened with my past signature requests?" — drives the
// client dashboard's Activity log section. Returns terminal-state
// rows (cancelled, signed, and pending-but-expired) so the
// recipient can audit "did the lawyer pull that back, or did I
// already sign it?" without digging through email.
export async function getMySignatureHistory(req, res) {
  const requests = await listHistoryForRecipient({ userId: req.user.sub });
  return res.status(200).json({ signatureRequests: requests });
}

// Recipient fetches one signature request with its frozen HTML snapshot.
// Access gated by recipient_user_id === req.user.sub.
export async function getMySignatureRequest(req, res) {
  const { requestId } = req.params;
  const request = await getSignatureRequestForSigner({
    requestId,
    userId: req.user.sub,
  });
  return res.status(200).json({ signatureRequest: request });
}

// Recipient submits their signature image (typed name canvas OR uploaded
// PNG/JPG, both produced as base64 data URLs client-side) ALONG WITH
// the rendered page captures — one PNG per assigned page taken on the
// signer's device with the signature already placed. The page PNGs are
// what the compiler embeds in the final signed PDF, so the signed
// artifact is byte-identical to what the signer reviewed.
export async function postSignature(req, res) {
  const { requestId } = req.params;
  const { signatureImage, signaturePlacement, signedPages } = req.body;
  const updated = await submitSignature({
    requestId,
    userId: req.user.sub,
    signatureImage,
    signaturePlacement,
    signedPages,
  });
  return res.status(200).json({ signatureRequest: updated });
}
