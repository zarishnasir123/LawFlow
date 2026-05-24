import axios from "axios";
import { apiClient } from "../../shared/api/axios";
import type { CurrentUser } from "./hooks/useCurrentUser";
import type { LoginSuccessResponse } from "./types";

type ResetPasswordPayload = {
  token: string;
  password: string;
  confirmPassword: string;
};

// Partial update payload for PATCH /auth/me. Every field is optional —
// only the keys actually included are sent to the backend, and only
// those columns get updated server-side. Address / city / tehsil
// write through to client_profiles; the rest write to users.
export type UpdateMyProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  cnic?: string;
  address?: string;
  city?: string;
  tehsil?: string;
};

// Payload for in-profile password rotation by a logged-in user.
// Distinct from the forgot-password flow which doesn't take a
// current password (it's gated by an email token instead).
export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const authApi = {
  forgotPassword: (email: string) =>
    apiClient.post("/auth/forgot-password", { email }),
  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post("/auth/reset-password", payload),
  // In-profile password rotation. Backend verifies the current
  // password, writes the new hash, AND revokes every refresh
  // session for the user in the same transaction, so the caller
  // must clear local auth state + send the user back to /login on
  // success. Rejected with 403 for Google-OAuth accounts (frontend
  // hides the entry button for those, but defence-in-depth keeps
  // the backend honest).
  changePassword: (payload: ChangePasswordPayload) =>
    apiClient.post("/auth/change-password", payload),
  updateMyProfile: async (payload: UpdateMyProfilePayload): Promise<CurrentUser> => {
    const { data } = await apiClient.patch<{ user: CurrentUser }>(
      "/auth/me",
      payload
    );
    return data.user;
  },
  // Profile-picture upload. The backend's multer middleware reads
  // the file from the "avatar" form field; that's the only name it
  // accepts. Returns the user with the freshly-generated public
  // avatar URL so the caller can swap it into the Tanstack cache.
  uploadAvatar: async (file: File): Promise<CurrentUser> => {
    const formData = new FormData();
    formData.append("avatar", file);
    const { data } = await apiClient.post<{ user: CurrentUser }>(
      "/auth/me/avatar",
      formData
    );
    return data.user;
  },
  // Clear the user's profile picture so the initials fallback
  // renders. The backend deletes both the DB column and the
  // Supabase storage object. Returns the updated user so the
  // caller can swap it into the Tanstack cache the same way the
  // upload mutation does.
  removeAvatar: async (): Promise<CurrentUser> => {
    const { data } = await apiClient.delete<{ user: CurrentUser }>(
      "/auth/me/avatar"
    );
    return data.user;
  },
  // Self-service account deactivation. Backend flips
  // account_status='inactive', stamps deactivated_at, revokes every
  // refresh session, and emails a confirmation. The next login
  // within 30 days will return a reactivation prompt; past 30 days
  // the account is hard-deleted.
  deactivateMyAccount: async (): Promise<void> => {
    await apiClient.delete("/auth/me");
  },
  // Second leg of the deactivation-recovery flow. Caller hands in
  // the short-lived reactivationToken returned by /auth/login or
  // /auth/google/session when the account was deactivated. Backend
  // verifies the token, flips status back to 'active', and returns
  // the same shape as a successful login.
  reactivateAccount: async (reactivationToken: string): Promise<LoginSuccessResponse> => {
    const { data } = await apiClient.post<LoginSuccessResponse>(
      "/auth/reactivate",
      { reactivationToken }
    );
    return data;
  },
};

type ApiErrorBody = {
  message?: string;
  errors?: { msg?: string; path?: string }[];
};

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;

    // Single-message errors (ApiError throws on the backend land here).
    if (data?.message) {
      return data.message;
    }

    // express-validator middleware returns { errors: [{ msg, path }, ...] }.
    // Surface the first message so the user sees the real validation reason
    // rather than a generic "Request failed with status code 400".
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (first?.msg) {
        return first.path ? `${first.path}: ${first.msg}` : first.msg;
      }
    }

    return error.message;
  }

  return "Unexpected error. Please try again.";
}
