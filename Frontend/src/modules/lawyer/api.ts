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
import type { AiChatMessage, AiChatRole } from "./data/aiGuidance";
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
// provider (Groq/Gemini) grounded in LawFlow's case templates. The backend
// returns the reply text plus up to three suggested follow-up questions. We wrap
// the reply into a chat message (id + timestamp); the page renders the
// suggestions as clickable chips. `history` carries the recent conversation so
// follow-up questions keep context.
export async function askAiLegalGuidance(
  prompt: string,
  history: { role: AiChatRole; text: string }[] = []
): Promise<{ message: AiChatMessage; suggestions: string[] }> {
  const { data } = await apiClient.post<{ reply: string; suggestions?: string[] }>(
    "/ai/guidance",
    { prompt, history }
  );

  return {
    message: {
      id: `ai-${Date.now()}`,
      role: "ai",
      text: data.reply,
      time: formatDate(new Date(), "time"),
      kind: "message",
    },
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
  };
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
