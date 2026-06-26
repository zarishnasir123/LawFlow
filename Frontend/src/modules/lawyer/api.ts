import { apiClient } from "../../shared/api/axios";
import type {
  AuthResponse,
  LawyerBarLicenseUploadPayload,
  LawyerDegreeUploadPayload,
  LawyerLoginPayload,
  LawyerOtpRequestPayload,
  LawyerOtpVerifyPayload,
  LawyerRegisterPayload,
  RegisterResponse,
  VerificationResponse,
} from "../auth/types";
import type {
  AiChatMessage,
  AiChatSession,
  AiChatSessionDetail,
  AiDraftTurn,
} from "./data/aiGuidance";
import { formatDate } from "../../shared/utils/formatDate";

export async function registerLawyer(
  payload: LawyerRegisterPayload
): Promise<RegisterResponse> {
  const formData = new FormData();

  formData.append("role", payload.role);
  formData.append("firstName", payload.firstName);
  formData.append("lastName", payload.lastName);
  formData.append("email", payload.email);
  formData.append("phone", payload.phone);
  formData.append("cnic", payload.cnic);
  formData.append("specialization", payload.specialization);
  formData.append("districtBar", payload.districtBar);
  formData.append("barLicenseNumber", payload.barLicenseNumber);
  formData.append("password", payload.password);

  if (payload.lawDegree) {
    formData.append("lawDegree", payload.lawDegree);
  }

  if (payload.barLicenseCardFront) {
    formData.append("barLicenseCardFront", payload.barLicenseCardFront);
  }

  if (payload.barLicenseCardBack) {
    formData.append("barLicenseCardBack", payload.barLicenseCardBack);
  }

  const { data } = await apiClient.post<RegisterResponse>(
    "/auth/register/lawyer",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data;
}

export async function loginLawyer(payload: LawyerLoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", {
    ...payload,
    expectedRole: "lawyer",
  });
  return data;
}

export async function sendLawyerOtp(
  payload: LawyerOtpRequestPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/lawyer/otp/send",
    payload
  );
  return data;
}

export async function verifyLawyerOtp(
  payload: LawyerOtpVerifyPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/lawyer/otp/verify",
    payload
  );
  return data;
}

export async function uploadLawyerDegree(
  payload: LawyerDegreeUploadPayload
): Promise<VerificationResponse> {
  const formData = new FormData();
  formData.append("lawDegree", payload.lawDegree);

  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/lawyer/documents/degree",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data;
}

export async function uploadLawyerBarLicenseCard(
  payload: LawyerBarLicenseUploadPayload
): Promise<VerificationResponse> {
  const formData = new FormData();
  formData.append("barLicenseCardFront", payload.barLicenseCardFront);
  formData.append("barLicenseCardBack", payload.barLicenseCardBack);

  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/lawyer/documents/bar-license",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data;
}

// AI Legal Guidance — calls the backend, which proxies to the active LLM
// provider (Groq/Gemini) grounded in LawFlow's case templates. Pass a
// `sessionId` to continue an existing conversation, or omit it to start a new
// one (the backend creates it and returns the id + auto-derived title). The
// server owns conversation history, so we no longer send it from the client.
// Returns the wrapped chat message, follow-up suggestions, and the resolved
// session id/title.
export async function askAiLegalGuidance(
  prompt: string,
  sessionId?: string
): Promise<{
  message: AiChatMessage;
  suggestions: string[];
  sessionId: string;
  title: string;
}> {
  const { data } = await apiClient.post<{
    reply: string;
    suggestions?: string[];
    sessionId: string;
    title: string;
  }>("/ai/guidance", { prompt, sessionId });

  return {
    message: {
      id: `ai-${Date.now()}`,
      role: "ai",
      text: data.reply,
      time: formatDate(new Date(), "time"),
      kind: "message",
    },
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    sessionId: data.sessionId,
    title: data.title,
  };
}

// AI case-drafting assistant (the panel inside the document editor). Distinct
// from askAiLegalGuidance: this drafts/rewrites case content for a SPECIFIC case
// (the backend pulls that case's context + verifies ownership). Ephemeral — pass
// recent turns as `history` for multi-turn refinement; nothing is persisted.
export async function draftCaseContent(
  caseId: string,
  instruction: string,
  history: AiDraftTurn[] = [],
  // "full_case" = the one-click "draft the complete case" action; omit/"section"
  // for the normal free-prompt chat.
  mode?: "section" | "full_case"
): Promise<{ draft: string }> {
  const { data } = await apiClient.post<{ draft: string }>("/ai/draft", {
    caseId,
    instruction,
    history,
    mode,
  });
  return { draft: data.draft };
}

// Inline "edit this selection" — the lawyer highlighted text in the document and
// gave an instruction (e.g. "fix grammar", or one supplying a CNIC/date). Returns
// ONLY the revised text to drop back in place of the selection.
export async function editCaseSelection(
  caseId: string,
  instruction: string,
  selection: string
): Promise<{ draft: string }> {
  const { data } = await apiClient.post<{ draft: string }>("/ai/draft", {
    caseId,
    instruction,
    selection,
    mode: "edit_selection",
  });
  return { draft: data.draft };
}

// AI conversation history (sidebar). Server state — consumed via TanStack Query.
export async function listAiSessions(): Promise<AiChatSession[]> {
  const { data } = await apiClient.get<{ sessions: AiChatSession[] }>("/ai/sessions");
  return data.sessions ?? [];
}

export async function getAiSession(sessionId: string): Promise<AiChatSessionDetail> {
  const { data } = await apiClient.get<{ session: AiChatSessionDetail }>(
    `/ai/sessions/${sessionId}`
  );
  return data.session;
}

export async function deleteAiSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/ai/sessions/${sessionId}`);
}

// Rename and/or pin a conversation. Pass any subset of { title, pinned }.
export async function updateAiSession(
  sessionId: string,
  patch: { title?: string; pinned?: boolean }
): Promise<AiChatSession> {
  const { data } = await apiClient.patch<{ session: AiChatSession }>(
    `/ai/sessions/${sessionId}`,
    patch
  );
  return data.session;
}

import type {
  ChatClient,
  ChatMessage,
  LawyerChatThread,
  SendMessagePayload,
} from "../../types/chat";

// =====================================================================
// Case chat (real backend). The conversation id IS the case id, so the
// `threadId` the chat screens pass around is a case UUID. The backend
// returns a role-agnostic `counterpart`; for the lawyer app that's the
// client, so we map it onto the LawyerChatThread.client field the UI uses.
// =====================================================================

interface ChatConversationDto {
  id: string;
  counterpart: ChatClient;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

function toLawyerThread(dto: ChatConversationDto): LawyerChatThread {
  return {
    id: dto.id,
    client: dto.counterpart,
    tags: [],
    lastMessage: dto.lastMessage ?? "",
    lastMessageAt: dto.lastMessageAt ?? new Date().toISOString(),
    unreadCount: dto.unreadCount ?? 0,
  };
}

export async function getLawyerThreads(): Promise<LawyerChatThread[]> {
  const { data } = await apiClient.get<{ conversations: ChatConversationDto[] }>(
    "/chat/conversations"
  );
  return (data.conversations ?? []).map(toLawyerThread);
}

export async function getThreadById(
  threadId: string
): Promise<LawyerChatThread | null> {
  try {
    const { data } = await apiClient.get<{ conversation: ChatConversationDto }>(
      `/chat/conversations/${threadId}`
    );
    return toLawyerThread(data.conversation);
  } catch {
    return null;
  }
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<{ messages: ChatMessage[] }>(
    `/chat/conversations/${threadId}/messages`
  );
  return data.messages ?? [];
}

export async function sendThreadMessage(
  threadId: string,
  payload: SendMessagePayload
): Promise<ChatMessage> {
  const { data } = await apiClient.post<{ message: ChatMessage }>(
    `/chat/conversations/${threadId}/messages`,
    { text: payload.text, replyToMessageId: payload.replyToMessageId }
  );
  return data.message;
}

// Mark the whole conversation read up to now (drives unread badges + the
// other side's "seen" tick). Best-effort from the UI's perspective.
export async function markThreadRead(threadId: string): Promise<void> {
  await apiClient.post(`/chat/conversations/${threadId}/read`);
}

// Upload a document to the conversation. Returns the created (file) message
// with a ready-to-open signed URL.
export async function sendThreadFile(
  threadId: string,
  file: File
): Promise<ChatMessage> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "file");
  const { data } = await apiClient.post<{ message: ChatMessage }>(
    `/chat/conversations/${threadId}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data.message;
}

// Upload a recorded voice note. Returns the created (voice) message.
export async function sendThreadVoice(
  threadId: string,
  blob: Blob,
  durationSeconds: number,
  mimeType: string
): Promise<ChatMessage> {
  const file = voiceBlobToFile(blob, mimeType);
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "voice");
  form.append("durationSeconds", String(durationSeconds));
  const { data } = await apiClient.post<{ message: ChatMessage }>(
    `/chat/conversations/${threadId}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data.message;
}

// Turn a recorded audio blob into a named File the backend can store. The
// extension mirrors the recorder's container so the saved object plays back.
function voiceBlobToFile(blob: Blob, mimeType: string): File {
  const base = (mimeType || "audio/webm").split(";")[0];
  const ext = base.includes("mp4")
    ? "m4a"
    : base.includes("ogg")
      ? "ogg"
      : base.includes("mpeg")
        ? "mp3"
        : base.includes("wav")
          ? "wav"
          : "webm";
  return new File([blob], `voice-message.${ext}`, { type: base });
}

// Cases
export async function getMyLawyerCases() {
  const { data } = await apiClient.get<{ cases: unknown[] }>("/cases");
  return data.cases ?? [];
}

export async function getMyCase(caseId: string) {
  const { data } = await apiClient.get<{ case: unknown }>(`/cases/${caseId}`);
  return data.case;
}
