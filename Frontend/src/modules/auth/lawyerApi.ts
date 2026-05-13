import { apiClient } from "../../shared/api/axios";

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
  password: string;
  confirmPassword: string;
  degreeDocument: File;
  licenseCardFrontImage: File;
  licenseCardBackImage: File;
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

function appendOptional(
  formData: FormData,
  key: string,
  value: string | number | null | undefined
) {
  if (value === null || value === undefined || value === "") return;
  formData.append(key, String(value));
}

export async function registerLawyer(payload: RegisterLawyerPayload) {
  const formData = new FormData();

  formData.append("firstName", payload.firstName);
  formData.append("lastName", payload.lastName);
  formData.append("email", payload.email);
  formData.append("phone", payload.phone);
  formData.append("cnic", payload.cnic);
  formData.append("specialization", payload.specialization);
  formData.append("districtBar", payload.districtBar);
  formData.append("barLicenseNumber", payload.barLicenseNumber);
  formData.append("password", payload.password);
  formData.append("confirmPassword", payload.confirmPassword);
  appendOptional(formData, "experienceYears", payload.experienceYears);
  appendOptional(formData, "consultationFee", payload.consultationFee);

  formData.append("degreeDocument", payload.degreeDocument);
  formData.append("licenseCardFrontImage", payload.licenseCardFrontImage);
  formData.append("licenseCardBackImage", payload.licenseCardBackImage);

  const { data } = await apiClient.post<RegisterLawyerResponse>(
    "/auth/register/lawyer",
    formData
  );

  return data;
}
