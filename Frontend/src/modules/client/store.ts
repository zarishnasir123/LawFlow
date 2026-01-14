import { create } from "zustand";

export interface ClientProfile {
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  address: string;
}

const DEFAULT_PROFILE: ClientProfile = {
  fullName: "Ahmed Khan",
  email: "ahmed.khan@example.com",
  phone: "+92 300 1234567",
  cnic: "12345-1234567-1",
  address: "House 123, Street 45, F-7, Islamabad",
};

type ClientProfileState = {
  profile: ClientProfile;
  initializeProfile: () => void;
  updateProfile: (profile: ClientProfile) => void;
  updateField: (field: keyof ClientProfile, value: string) => void;
};

export const useClientProfileStore = create<ClientProfileState>((set) => ({
  profile: DEFAULT_PROFILE,

  initializeProfile: () => {
    const savedProfile = localStorage.getItem("clientProfile");
    if (savedProfile) {
      try {
        const parsedProfile = JSON.parse(savedProfile);
        set({ profile: parsedProfile });
      } catch {
        set({ profile: DEFAULT_PROFILE });
      }
    } else {
      set({ profile: DEFAULT_PROFILE });
    }
  },

  updateProfile: (profile: ClientProfile) => {
    localStorage.setItem("clientProfile", JSON.stringify(profile));
    set({ profile });
  },

  updateField: (field: keyof ClientProfile, value: string) => {
    set((state) => {
      const updatedProfile = { ...state.profile, [field]: value };
      return { profile: updatedProfile };
    });
  },
}));
