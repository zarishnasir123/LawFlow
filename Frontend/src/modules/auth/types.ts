export type RegisterRole = "client" | "lawyer";
export type LoginRole = "client" | "lawyer" | "registrar" | "admin";

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

export type VerificationResponse = {
  message: string;
  user?: {
    email: string;
    emailVerified: boolean;
  };
  verification?: {
    email: string;
    emailSent: boolean;
    emailQueued?: boolean;
    deliveryMode: "smtp" | "console";
    deliveryReason?: string;
    expiresAt: string;
  };
};

export type ClientRegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cnic: string;
  password: string;
  confirmPassword: string;
  agree: boolean;
};

export type ClientRegisterSubmit = Omit<ClientRegisterFormValues, "confirmPassword" | "agree">;

export type ClientRegisterPayload = ClientRegisterSubmit & {
  confirmPassword: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type ClientLoginPayload = LoginPayload;

export type ClientEmailVerificationRequest = {
  email: string;
};

export type ClientEmailVerificationPayload = {
  email: string;
  otp: string;
};

export type ClientCnicVerificationPayload = {
  cnic: string;
};

export type LawyerRegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cnic: string;
  specialization: string;
  districtBar: string;
  barLicenseNumber: string;
  lawDegree: File | null;
  barLicenseCard: File | null;
  password: string;
  confirmPassword: string;
  agree: boolean;
};

export type LawyerRegisterSubmit = Omit<LawyerRegisterFormValues, "confirmPassword" | "agree">;

export type LawyerRegisterPayload = LawyerRegisterSubmit & {
  role: "lawyer";
};

export type LawyerLoginPayload = LoginPayload;

export type RegistrarLoginPayload = LoginPayload;

export type AdminLoginPayload = LoginPayload;

export type LawyerOtpRequestPayload = {
  phone: string;
};

export type LawyerOtpVerifyPayload = {
  phone: string;
  code: string;
};

export type LawyerDegreeUploadPayload = {
  lawDegree: File;
};

export type LawyerBarLicenseUploadPayload = {
  barLicenseCard: File;
};

export type RegisterResponse = {
  message: string;
  user: AuthUser;
  verification?: {
    emailSent: boolean;
    emailQueued?: boolean;
    deliveryMode: "smtp" | "console";
    deliveryReason?: string;
    expiresAt: string;
  };
};
