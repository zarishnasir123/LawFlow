import {
  cancelSignatureRequest,
  createSignatureRequest,
  getSignatureRequestByToken,
  listSignatureRequestsForCase,
  saveEditedDocument,
  submitClientSignature,
} from "./signatures.service.js";

// Lawyer-side: PUT the current edited HTML state of a case document.
// Frontend calls this on Save Draft (manual) and on a debounced interval
// while editing. Body: { editedHtml: string }. Returns updatedAt so the
// editor can show "Saved 2m ago".
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

// Lawyer-side: create a new signature request on a case. The plaintext
// signing token is returned here once — never persisted — so the caller
// can compose an email body containing the signing URL.
export async function postSignatureRequest(req, res) {
  const { caseId } = req.params;
  const {
    recipientEmail,
    recipientName,
    documentHtmlSnapshot,
    pageIndices,
    requiresClientSignature = true,
    requiresLawyerSignature = false,
  } = req.body;

  const { request, token } = await createSignatureRequest({
    caseId,
    lawyerUserId: req.user.sub,
    recipientEmail: recipientEmail.trim().toLowerCase(),
    recipientName: recipientName?.trim() || null,
    documentHtmlSnapshot,
    pageIndices: pageIndices ?? null,
    requiresClientSignature,
    requiresLawyerSignature,
  });

  // Build the public signing URL. Frontend may also build this from
  // the token itself, but returning it from the server keeps the
  // canonical link assembly in one place.
  const baseUrl = (
    process.env.PUBLIC_APP_URL || "http://localhost:5173"
  ).replace(/\/$/, "");
  const signingUrl = `${baseUrl}/sign/${token}`;

  return res.status(201).json({
    signatureRequest: request,
    signingUrl,
    // Plaintext token returned ONCE. Never log it.
    token,
  });
}

// Lawyer-side: list all signature requests for a case. Used by the
// editor's poll loop (every 10s while open) to refresh per-page badges.
export async function getCaseSignatureRequests(req, res) {
  const { caseId } = req.params;
  const requests = await listSignatureRequestsForCase({
    caseId,
    lawyerUserId: req.user.sub,
  });
  return res.status(200).json({ signatureRequests: requests });
}

// Public side: client opens the signing link. Returns the frozen HTML
// snapshot and request metadata (no auth required).
export async function getPublicSigningRequest(req, res) {
  const { token } = req.params;
  const request = await getSignatureRequestByToken(token);
  return res.status(200).json({ signatureRequest: request });
}

// Public side: client submits their signature.
export async function postClientSignature(req, res) {
  const { token } = req.params;
  const { signatureImage } = req.body;
  const updated = await submitClientSignature({ token, signatureImage });
  return res.status(200).json({ signatureRequest: updated });
}

// Lawyer-side: cancel a request before completion.
export async function deleteSignatureRequest(req, res) {
  const { requestId } = req.params;
  const updated = await cancelSignatureRequest({
    requestId,
    lawyerUserId: req.user.sub,
  });
  return res.status(200).json({ signatureRequest: updated });
}
