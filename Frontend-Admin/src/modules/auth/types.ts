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
