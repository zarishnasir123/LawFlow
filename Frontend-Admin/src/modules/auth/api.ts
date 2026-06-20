import axios from "axios";
import { apiClient } from "../../shared/api/axios";
import type { CurrentUser } from "./hooks/useCurrentUser";
import type {
  AdminLoginPayload,
  AuthResponse,
  ChangePasswordPayload,
  ResetPasswordPayload,
  UpdateMyProfilePayload,
} from "./types";

export async function loginAdmin(
  payload: AdminLoginPayload
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", {
    ...payload,
    expectedRole: "admin",
  });
  return data;
}

export async function logoutAdmin(): Promise<void> {
  await apiClient.post("/auth/logout");
}

// Admin self-service profile + password endpoints. All hit the shared, role-
// agnostic /auth/* routes the client/lawyer apps already use — the admin just
// never had a UI for them. Grouped under `authApi` so the profile/forgot/reset
// screens read like the client app's.
export const authApi = {
  // Partial profile update (PATCH /auth/me). Only changed keys are sent; email
  // + cnic are deliberately never included (locked in the UI, rejected server-
  // side). Returns the fresh user for the ["currentUser"] cache.
  updateMyProfile: async (
    payload: UpdateMyProfilePayload
  ): Promise<CurrentUser> => {
    const { data } = await apiClient.patch<{ user: CurrentUser }>(
      "/auth/me",
      payload
    );
    return data.user;
  },

  // Profile-picture upload. Backend multer middleware reads the `avatar` field
  // from a multipart body. Returns the user with a fresh signed avatarUrl.
  uploadAvatar: async (file: File): Promise<CurrentUser> => {
    const form = new FormData();
    form.append("avatar", file);
    const { data } = await apiClient.post<{ user: CurrentUser }>(
      "/auth/me/avatar",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data.user;
  },

  // Clears the profile picture (DELETE /auth/me/avatar).
  removeAvatar: async (): Promise<CurrentUser> => {
    const { data } = await apiClient.delete<{ user: CurrentUser }>(
      "/auth/me/avatar"
    );
    return data.user;
  },

  // In-profile password rotation. Backend verifies the current password, writes
  // the new hash, AND revokes every refresh session in the same transaction —
  // so on success the caller must clear local auth and return to /login.
  changePassword: (payload: ChangePasswordPayload) =>
    apiClient.post("/auth/change-password", payload),

  // Forgot-password (logged-out): emails a reset link. The backend routes admin
  // links back to this panel. Always resolves the same way (enumeration-safe).
  forgotPassword: (email: string) =>
    apiClient.post("/auth/forgot-password", { email }),

  // Reset-password: consumes the emailed token + sets a new password.
  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post("/auth/reset-password", payload),
};

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }

  return "Unexpected error. Please try again.";
}
