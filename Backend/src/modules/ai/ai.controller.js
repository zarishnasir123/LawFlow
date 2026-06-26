import {
  askLegalGuidance,
  appendTurn,
  deleteSession,
  draftCaseContent,
  generateSessionTitle,
  getRecentMessagesForContext,
  getSessionWithMessages,
  listSessions,
  updateSession
} from "./ai.service.js";
import { getCaseForLawyer } from "../cases/cases.service.js";
import { ApiError } from "../../utils/apiError.js";

// Statuses where the case document is still editable (and so draftable).
const EDITABLE_STATUSES = new Set(["draft", "returned"]);

// GET /api/ai/sessions — the lawyer's conversations for the sidebar,
// most-recently-used first. Scoped to req.user.sub.
export async function getSessions(req, res) {
  const sessions = await listSessions(req.user.sub);
  return res.status(200).json({ sessions });
}

// GET /api/ai/sessions/:sessionId — one conversation with its messages.
// Ownership is enforced in the service (404 if not the caller's).
export async function getSession(req, res) {
  const session = await getSessionWithMessages(req.user.sub, req.params.sessionId);
  return res.status(200).json({ session });
}

// PATCH /api/ai/sessions/:sessionId — rename and/or pin a conversation.
// Body carries any of { title, pinned }. Ownership enforced in the service.
export async function patchSession(req, res) {
  const { title, pinned } = req.body;
  const session = await updateSession(req.user.sub, req.params.sessionId, {
    title: title === undefined ? undefined : title.trim(),
    pinned
  });
  return res.status(200).json({ session });
}

// DELETE /api/ai/sessions/:sessionId — remove a conversation the caller owns.
export async function removeSession(req, res) {
  await deleteSession(req.user.sub, req.params.sessionId);
  return res.status(204).send();
}

// POST /api/ai/guidance — ask the grounded assistant a question inside a
// conversation. The server is the source of truth for history: if a sessionId
// is given (and owned), we load that session's recent messages as LLM context;
// otherwise a new session is created. We persist the user prompt + AI reply,
// then return the answer, follow-up suggestions, and the resolved session.
export async function postLegalGuidance(req, res) {
  const userId = req.user.sub;
  const { prompt, sessionId } = req.body;

  // Build context from the conversation so far (empty for a brand-new chat).
  // getRecentMessagesForContext only reads by sessionId, so verify ownership
  // first via getSessionWithMessages, which 404s on someone else's session.
  let history = [];
  if (sessionId) {
    await getSessionWithMessages(userId, sessionId);
    history = await getRecentMessagesForContext(sessionId);
  }

  // For a brand-new conversation, generate a clean sidebar title in parallel
  // with the answer (the title only needs the prompt). Existing sessions keep
  // their current title.
  const [{ reply, suggestions }, generatedTitle] = await Promise.all([
    askLegalGuidance({ prompt, history }),
    sessionId ? Promise.resolve(undefined) : generateSessionTitle(prompt)
  ]);

  const { sessionId: resolvedSessionId, title } = await appendTurn({
    userId,
    sessionId: sessionId || null,
    userText: prompt,
    aiText: reply,
    title: generatedTitle
  });

  return res.status(200).json({
    reply,
    suggestions,
    sessionId: resolvedSessionId,
    title
  });
}

// POST /api/ai/draft — case-drafting helper used by the AI panel in the document
// editor. Verifies the caller OWNS the case (404 otherwise) and that it's still
// editable (409 if locked), then drafts/rewrites from the lawyer's instruction.
// Ephemeral: nothing is persisted; `history` (recent turns) drives refinement.
export async function postDraft(req, res) {
  const { caseId, instruction, history, mode, selection } = req.body;

  // Ownership + existence: getCaseForLawyer 404s on another lawyer's case.
  const caseCtx = await getCaseForLawyer({ caseId, lawyerUserId: req.user.sub });
  if (!EDITABLE_STATUSES.has(caseCtx.status)) {
    throw new ApiError(409, "This case is locked and can no longer be drafted.");
  }

  const { draft } = await draftCaseContent({ caseCtx, instruction, history, mode, selection });
  return res.status(200).json({ draft });
}
