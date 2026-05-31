export type CaseCategory = "civil" | "family";

export type CivilCaseType =
  | "civil_recovery_of_money"
  | "civil_permanent_injunction"
  | "civil_declaration"
  | "civil_specific_performance"
  | "civil_possession_of_property";

export type FamilyCaseType =
  | "family_khula"
  | "family_maintenance"
  | "family_dowry_recovery"
  | "family_minor_custody"
  | "family_conjugal_rights";

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
