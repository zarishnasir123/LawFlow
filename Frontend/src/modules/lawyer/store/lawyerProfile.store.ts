import { create } from "zustand";

export interface LawyerProfile {
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  barCouncilNumber: string;
  specialization: string;
  yearsOfExperience: string;
  address: string;
  officeLocation: string;
  bio: string;
  profileImageUrl: string;
}

interface LawyerProfileStore {
  profile: LawyerProfile;
  initializeProfile: () => void;
  updateField: <K extends keyof LawyerProfile>(
    field: K,
    value: LawyerProfile[K]
  ) => void;
  updateProfile: (profile: LawyerProfile) => void;
  resetProfile: () => void;
}

const defaultProfile: LawyerProfile = {
  fullName: "Adv. Fatima Ali",
  email: "fatima.ali@lawfirm.com",
  phone: "+92 321 7654321",
  cnic: "54321-7654321-9",
  barCouncilNumber: "ISB-2018-1234",
  specialization: "Civil Law",
  yearsOfExperience: "6",
  address: "Office 301, Blue Area, Islamabad",
  officeLocation: "Islamabad",
  bio: "Experienced lawyer specializing in civil litigation and contract law.",
  profileImageUrl: "https://via.placeholder.com/150",
};

export const useLawyerProfileStore = create<LawyerProfileStore>((set) => ({
  profile: defaultProfile,

  initializeProfile: () => {
    const stored = localStorage.getItem("lawyerProfile");
    if (stored) {
      try {
        set({ profile: JSON.parse(stored) });
      } catch {
        set({ profile: defaultProfile });
      }
    } else {
      set({ profile: defaultProfile });
    }
  },

  updateField: (field, value) => {
    set((state) => {
      const updated = { ...state.profile, [field]: value };
      localStorage.setItem("lawyerProfile", JSON.stringify(updated));
      return { profile: updated };
    });
  },

  updateProfile: (profile) => {
    localStorage.setItem("lawyerProfile", JSON.stringify(profile));
    set({ profile });
  },

  resetProfile: () => {
    localStorage.removeItem("lawyerProfile");
    set({ profile: defaultProfile });
  },
}));
