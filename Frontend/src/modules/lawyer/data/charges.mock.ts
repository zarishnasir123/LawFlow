import type { CaseTypeOption, CaseType } from "../types/charges";

export const CIVIL_CASE_TYPES: CaseTypeOption[] = [
  {
    id: "civil_recovery_of_money",
    label: "Suit for Recovery of Money",
    description: "Civil Procedure Code (CPC), 1908",
    category: "civil",
  },
  {
    id: "civil_permanent_injunction",
    label: "Suit for Permanent Injunction",
    description: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "civil_declaration",
    label: "Suit for Declaration",
    description: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "civil_specific_performance",
    label: "Suit for Specific Performance of Agreement",
    description: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "civil_possession_of_property",
    label: "Suit for Possession of Property",
    description: "Civil Procedure Code (CPC), 1908",
    category: "civil",
  },
];

export const FAMILY_CASE_TYPES: CaseTypeOption[] = [
  {
    id: "family_khula",
    label: "Khula (Wife's Judicial Divorce)",
    description: "Dissolution of Muslim Marriages Act, 1939 & MFLO, 1961",
    category: "family",
  },
  {
    id: "family_maintenance",
    label: "Maintenance (Wife & Children)",
    description: "MFLO, 1961 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "family_dowry_recovery",
    label: "Recovery of Dowry Articles / Personal Property",
    description: "Dowry & Bridal Gifts Act, 1976 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "family_minor_custody",
    label: "Custody of Minors (Hizanat)",
    description: "Guardian and Wards Act, 1890 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "family_conjugal_rights",
    label: "Restitution of Conjugal Rights",
    description: "Family Courts Act, 1964",
    category: "family",
  },
];

export const ALL_CASE_TYPES: CaseTypeOption[] = [
  ...CIVIL_CASE_TYPES,
  ...FAMILY_CASE_TYPES,
];

export function getCaseTypeLabel(caseType: CaseType): string {
  const caseOption = ALL_CASE_TYPES.find((ct) => ct.id === caseType);
  return caseOption?.label || caseType;
}
