import { authApi } from "./api";

export type LawyerDocumentPayload = {
  storageBucket: string;
  storagePath: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type RegisterLawyerPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cnic: string;
  specialization: "Civil" | "Family" | "civil" | "family";
  districtBar: string;
  barLicenseNumber: string;
  experienceYears?: number | null;
  consultationFee?: number | null;
  degreeDocument: LawyerDocumentPayload;
  licenseCardFrontImage: LawyerDocumentPayload;
  licenseCardBackImage: LawyerDocumentPayload;
  extractedCnic?: string | null;
  ocrReadable?: boolean;
  password: string;
  confirmPassword: string;
};

export type RegisterLawyerResponse = {
  message: string;
  user: {
    id: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    cnic: string;
    role: "lawyer";
    emailVerified: boolean;
    accountStatus: string;
    verificationStatus: string;
    cnicMatch: boolean;
    createdAt: string;
  };
  verification: {
    emailSent: boolean;
    emailQueued: boolean;
    deliveryMode: string;
    deliveryReason?: string;
    expiresAt: string;
  };
};

export async function registerLawyer(payload: RegisterLawyerPayload) {
  const { data } = await authApi.post<RegisterLawyerResponse>(
    "/auth/register/lawyer",
    payload
  );

  return data;
}
