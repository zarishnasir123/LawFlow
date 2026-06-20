// Backend still understands all roles; LoginRole is intentionally kept as a
// union because the API returns this exact set on /auth/login. The admin
// panel only ever expects "admin" but we read whatever the server sends and
// defend against mismatches at the call site (AdminLoginForm).
export type LoginRole = "client" | "lawyer" | "registrar" | "admin";

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  cnic?: string;
  role: LoginRole;
  emailVerified?: boolean;
  accountStatus?: string;
  createdAt?: string;
};

export type AuthResponse = {
  message: string;
  user: AuthUser;
  accessToken: string;
  refreshTokenExpiresAt: string;
  session?: {
    rememberMe: boolean;
    expiresAt: string;
  };
};

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type AdminLoginPayload = LoginPayload;

// Partial update for PATCH /auth/me. Every field optional; only included keys
// are sent. Email + CNIC are intentionally absent — they're locked in the admin
// UI and the backend rejects a CNIC change outright.
export type UpdateMyProfilePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
};

// In-profile password rotation (caller knows the current password).
export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// Forgot-password reset, gated by the emailed token instead of a current
// password.
export type ResetPasswordPayload = {
  token: string;
  password: string;
  confirmPassword: string;
};
