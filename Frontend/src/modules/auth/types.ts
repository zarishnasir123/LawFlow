export type RegisterRole = "client" | "lawyer";

export type AuthResponse = {
  token: string;
  role: RegisterRole;
  expiresAt?: string;
};

export type VerificationResponse = {
  status: "pending" | "verified";
  message?: string;
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
  role: "client";
};

export type ClientLoginPayload = {
  email: string;
  password: string;
};

export type ClientEmailVerificationRequest = {
  email: string;
};

export type ClientEmailVerificationPayload = {
  token: string;
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

export type LawyerLoginPayload = {
  email: string;
  password: string;
};

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
  id: string;
  role: RegisterRole;
  email: string;
  requiresEmailVerification?: boolean;
  requiresCnicVerification?: boolean;
};
