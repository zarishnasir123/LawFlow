import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RegistrarRole = "Registrar";

export type RegistrarAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cnic: string;
  role: RegistrarRole;
  password: string;
  status: "active" | "inactive";
  credentialsEmailStatus: "not_sent" | "sent";
  credentialsEmailSentAt?: string;
  createdAt: string;
  updatedAt: string;
};

type RegistrarCreateInput = {
  name: string;
  email: string;
  phone: string;
  cnic: string;
  role: RegistrarRole;
  password: string;
};

type RegistrarUpdateInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cnic: string;
  role: RegistrarRole;
};

type RegistrarAccountsState = {
  registrars: RegistrarAccount[];
  createRegistrar: (input: RegistrarCreateInput) => RegistrarAccount;
  updateRegistrar: (input: RegistrarUpdateInput) => void;
  deleteRegistrar: (id: string) => void;
  sendCredentialsByEmail: (id: string) => void;
  setRegistrarStatus: (id: string, status: "active" | "inactive") => void;
  getRegistrarById: (id: string) => RegistrarAccount | undefined;
  authenticateRegistrar: (
    email: string,
    password: string,
  ) => RegistrarAccount | undefined;
};

const nowIso = () => new Date().toISOString();

const seedRegistrars: RegistrarAccount[] = [
  {
    id: "reg-1",
    name: "Muhammad Asif",
    email: "asif.registrar@lawflow.pk",
    phone: "+92 300 1234567",
    cnic: "12345-1234567-1",
    role: "Registrar",
    password: "Registrar@123",
    status: "active",
    credentialsEmailStatus: "sent",
    credentialsEmailSentAt: "2026-02-01T10:02:00.000Z",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "reg-2",
    name: "Ayesha Khan",
    email: "ayesha.registrar@lawflow.pk",
    phone: "+92 301 2223344",
    cnic: "12345-2223344-8",
    role: "Registrar",
    password: "Registrar@123",
    status: "active",
    credentialsEmailStatus: "sent",
    credentialsEmailSentAt: "2026-02-02T11:32:00.000Z",
    createdAt: "2026-02-02T11:30:00.000Z",
    updatedAt: "2026-02-02T11:30:00.000Z",
  },
];

export const useRegistrarAccountsStore = create<RegistrarAccountsState>()(
  persist(
    (set, get) => ({
      registrars: seedRegistrars,

      createRegistrar: (input) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const emailExists = get().registrars.some(
          (reg) => reg.email.toLowerCase() === normalizedEmail,
        );

        if (emailExists) {
          throw new Error("A registrar account with this email already exists.");
        }

        const timestamp = nowIso();
        const created: RegistrarAccount = {
          id: `reg-${Date.now()}`,
          name: input.name.trim(),
          email: normalizedEmail,
          phone: input.phone.trim(),
          cnic: input.cnic.trim(),
          role: input.role,
          password: input.password,
          status: "active",
          credentialsEmailStatus: "not_sent",
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set((state) => ({
          registrars: [created, ...state.registrars],
        }));

        return created;
      },

      updateRegistrar: (input) => {
        const normalizedEmail = input.email.trim().toLowerCase();
        const emailExists = get().registrars.some(
          (reg) =>
            reg.id !== input.id &&
            reg.email.toLowerCase() === normalizedEmail,
        );

        if (emailExists) {
          throw new Error("A registrar account with this email already exists.");
        }

        set((state) => ({
          registrars: state.registrars.map((reg) =>
            reg.id === input.id
              ? {
                  ...reg,
                  name: input.name.trim(),
                  email: normalizedEmail,
                  phone: input.phone.trim(),
                  cnic: input.cnic.trim(),
                  role: input.role,
                  updatedAt: nowIso(),
                }
              : reg,
          ),
        }));
      },

      deleteRegistrar: (id) => {
        const target = get().registrars.find((reg) => reg.id === id);
        if (!target) {
          throw new Error("Registrar account not found.");
        }
        if (target.status === "active") {
          throw new Error(
            "Deactivate registrar account before deleting it.",
          );
        }

        set((state) => ({
          registrars: state.registrars.filter((reg) => reg.id !== id),
        }));
      },

      sendCredentialsByEmail: (id) => {
        const timestamp = nowIso();
        set((state) => ({
          registrars: state.registrars.map((reg) =>
            reg.id === id
              ? {
                  ...reg,
                  credentialsEmailStatus: "sent",
                  credentialsEmailSentAt: timestamp,
                  updatedAt: timestamp,
                }
              : reg,
          ),
        }));
      },

      setRegistrarStatus: (id, status) => {
        set((state) => ({
          registrars: state.registrars.map((reg) =>
            reg.id === id ? { ...reg, status, updatedAt: nowIso() } : reg,
          ),
        }));
      },

      getRegistrarById: (id) => get().registrars.find((reg) => reg.id === id),

      authenticateRegistrar: (email, password) =>
        get().registrars.find(
          (reg) =>
            reg.status === "active" &&
            reg.email.toLowerCase() === email.trim().toLowerCase() &&
            reg.password === password,
        ),
    }),
    {
      name: "lawflow_admin_registrar_accounts",
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as {
          registrars?: Array<RegistrarAccount & { role?: string }>;
        };

        if (!state?.registrars) {
          return persistedState;
        }

        return {
          ...state,
          registrars: state.registrars.map((reg) => ({
            ...reg,
            role: "Registrar" as const,
          })),
        };
      },
    },
  ),
);
