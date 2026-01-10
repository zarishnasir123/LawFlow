import { create } from "zustand";
import type { RegisterRole } from "./types";

type RegisterState = {
  role: RegisterRole;
  setRole: (role: RegisterRole) => void;
};

export const useRegisterStore = create<RegisterState>((set) => ({
  role: "client",
  setRole: (role) => set({ role }),
}));
