import { create } from "zustand";
import type { LoginRole, RegisterRole } from "./types";

type RegisterState = {
  role: RegisterRole;
  setRole: (role: RegisterRole) => void;
};

export const useRegisterStore = create<RegisterState>((set) => ({
  role: "client",
  setRole: (role) => set({ role }),
}));

type LoginState = {
  role: LoginRole;
  email: string;
  setRole: (role: LoginRole) => void;
  setEmail: (email: string) => void;
};

export const useLoginStore = create<LoginState>((set) => ({
  role: "client",
  email: "",
  setRole: (role) => set({ role }),
  setEmail: (email) => set({ email }),
}));
