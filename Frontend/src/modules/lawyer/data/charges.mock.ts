import type { CaseTypeOption, ServiceCharge, CaseType } from "../types/charges";

export const CIVIL_CASE_TYPES: CaseTypeOption[] = [
  {
    id: "recovery_of_money",
    label: "Suit for Recovery of Money",
    description: "Civil Procedure Code (CPC), 1908",
    category: "civil",
  },
  {
    id: "permanent_injunction",
    label: "Suit for Permanent Injunction",
    description: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "declaration",
    label: "Suit for Declaration",
    description: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "specific_performance",
    label: "Suit for Specific Performance of Agreement",
    description: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "possession_of_property",
    label: "Suit for Possession of Property",
    description: "Civil Procedure Code (CPC), 1908",
    category: "civil",
  },
];

export const FAMILY_CASE_TYPES: CaseTypeOption[] = [
  {
    id: "khula",
    label: "Khula (Wife's Judicial Divorce)",
    description: "Dissolution of Muslim Marriages Act, 1939 & MFLO, 1961",
    category: "family",
  },
  {
    id: "maintenance",
    label: "Maintenance (Wife & Children)",
    description: "MFLO, 1961 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "dowry_recovery",
    label: "Recovery of Dowry Articles / Personal Property",
    description: "Dowry & Bridal Gifts Act, 1976 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "custody_of_minors",
    label: "Custody of Minors (Hizanat)",
    description: "Guardian and Wards Act, 1890 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "restitution_of_rights",
    label: "Restitution of Conjugal Rights",
    description: "Family Courts Act, 1964",
    category: "family",
  },
];

export const ALL_CASE_TYPES: CaseTypeOption[] = [
  ...CIVIL_CASE_TYPES,
  ...FAMILY_CASE_TYPES,
];

export function getInitialServiceCharges(): ServiceCharge[] {
  const now = new Date().toISOString();
  return [
    {
      id: "sc-1",
      caseType: "recovery_of_money",
      category: "civil",
      caseName: "Suit for Recovery of Money",
      consultationFee: 5000,
      documentPreparationFee: 8000,
      totalFee: 13000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "sc-2",
      caseType: "permanent_injunction",
      category: "civil",
      caseName: "Suit for Permanent Injunction",
      consultationFee: 6000,
      documentPreparationFee: 10000,
      totalFee: 16000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "sc-3",
      caseType: "khula",
      category: "family",
      caseName: "Khula (Wife's Judicial Divorce)",
      consultationFee: 4000,
      documentPreparationFee: 7000,
      totalFee: 11000,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getCaseTypeLabel(caseType: CaseType): string {
  const caseOption = ALL_CASE_TYPES.find((ct) => ct.id === caseType);
  return caseOption?.label || caseType;
}
