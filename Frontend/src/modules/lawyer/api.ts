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

  if (payload.barLicenseCard) {
    formData.append("barLicenseCard", payload.barLicenseCard);
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
  const { data } = await apiClient.post<AuthResponse>("/auth/login/lawyer", payload);
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
  formData.append("barLicenseCard", payload.barLicenseCard);

  const { data } = await apiClient.post<VerificationResponse>(
    "/auth/lawyer/documents/bar-license",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data;
}
