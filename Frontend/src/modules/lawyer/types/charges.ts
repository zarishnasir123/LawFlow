export type CaseCategory = "civil" | "family";

export type CivilCaseType =
  | "recovery_of_money"
  | "permanent_injunction"
  | "declaration"
  | "specific_performance"
  | "possession_of_property";

export type FamilyCaseType =
  | "khula"
  | "maintenance"
  | "dowry_recovery"
  | "custody_of_minors"
  | "restitution_of_rights";

export type CaseType = CivilCaseType | FamilyCaseType;

export interface ServiceCharge {
  id: string;
  caseType: CaseType;
  category: CaseCategory;
  caseName: string;
  consultationFee: number;
  documentPreparationFee: number;
  totalFee: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaseTypeOption {
  id: CaseType;
  label: string;
  description: string;
  category: CaseCategory;
}
