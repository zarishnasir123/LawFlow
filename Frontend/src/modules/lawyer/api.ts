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

import type { ChatMessage, LawyerChatThread, SendMessagePayload } from "../../types/chat";
import { mockMessagesByThread, mockThreads } from "./data/chat.mock";

// Mocked APIs (backend later)
export async function getLawyerThreads(): Promise<LawyerChatThread[]> {
  return Promise.resolve(mockThreads);
}

export async function getThreadById(threadId: string): Promise<LawyerChatThread | null> {
  const thread = mockThreads.find((t) => t.id === threadId);
  return Promise.resolve(thread ?? null);
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  return Promise.resolve(mockMessagesByThread[threadId] ?? []);
}

export async function sendThreadMessage(
  threadId: string,
  payload: SendMessagePayload
): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: `m-${Date.now()}`,
    threadId,
    sender: "lawyer",
    text: payload.text,
    createdAt: new Date().toISOString(),
  };

  const existing = mockMessagesByThread[threadId] ?? [];
  mockMessagesByThread[threadId] = [...existing, msg];

  return Promise.resolve(msg);
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
