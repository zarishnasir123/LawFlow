import { create } from "zustand";
import type { ServiceCharge, CaseType } from "./types/charges";

interface ServiceChargesState {
  charges: ServiceCharge[];
  setCharges: (charges: ServiceCharge[]) => void;
  updateCharge: (id: string, charge: Partial<ServiceCharge>) => void;
  addCharge: (charge: ServiceCharge) => void;
  deleteCharge: (id: string) => void;
  getChargeByType: (caseType: CaseType) => ServiceCharge | undefined;
}

export const useServiceChargesStore = create<ServiceChargesState>((set, get) => ({
  charges: [],
  
  setCharges: (charges) => set({ charges }),
  
  updateCharge: (id, updatedCharge) =>
    set((state) => ({
      charges: state.charges.map((charge) =>
        charge.id === id
          ? { ...charge, ...updatedCharge, updatedAt: new Date().toISOString() }
          : charge
      ),
    })),
  
  addCharge: (charge) =>
    set((state) => ({
      charges: [...state.charges, charge],
    })),
  
  deleteCharge: (id) =>
    set((state) => ({
      charges: state.charges.filter((charge) => charge.id !== id),
    })),
  
  getChargeByType: (caseType) => {
    const state = get();
    return state.charges.find((charge) => charge.caseType === caseType);
  },
}));
