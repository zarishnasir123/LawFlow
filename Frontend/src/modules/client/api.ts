import { apiClient } from "../../shared/api/axios";
import type {
  AuthResponse,
  ClientCnicVerificationPayload,
  ClientEmailVerificationPayload,
  ClientEmailVerificationRequest,
  ClientLoginPayload,
  ClientRegisterPayload,
  RegisterResponse,
  VerificationResponse,
} from "../auth/types";

export async function registerClient(
  payload: ClientRegisterPayload
): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>("/auth/register/client", payload);
  return data;
}

export async function loginClient(payload: ClientLoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login/client", payload);
  return data;
}

export async function sendClientEmailVerification(
  payload: ClientEmailVerificationRequest
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/client/email/send",
    payload
  );
  return data;
}

export async function verifyClientEmail(
  payload: ClientEmailVerificationPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/client/email/verify",
    payload
  );
  return data;
}

export async function verifyClientCnic(
  payload: ClientCnicVerificationPayload
): Promise<VerificationResponse> {
  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/client/cnic/verify",
    payload
  );
  return data;
}

import type { ChatMessage, SendMessagePayload, ClientChatThread } from "../../types/chat";
import { mockClientThreads, mockClientMessages } from "./data/chat.mock";

/** Get all threads */
export async function getClientThreads(): Promise<ClientChatThread[]> {
  return Promise.resolve(mockClientThreads);
}

/** Get a single thread by ID */
export async function getClientThreadById(threadId: string): Promise<ClientChatThread | null> {
  const thread = mockClientThreads.find((t) => t.id === threadId);
  return Promise.resolve(thread ?? null);
}

/** Get messages for a specific thread */
export async function getClientThreadMessages(threadId: string): Promise<ChatMessage[]> {
  return Promise.resolve(mockClientMessages[threadId] ?? []);
}

/** Send a message as client */
export async function sendClientThreadMessage(
  threadId: string,
  payload: SendMessagePayload
): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: `cmsg-${Date.now()}`,
    threadId,
    sender: "client",
    text: payload.text,
    createdAt: new Date().toISOString(),
  };

  const existing = mockClientMessages[threadId] ?? [];
  mockClientMessages[threadId] = [...existing, msg];

  return Promise.resolve(msg);
}
