export interface CaseType {
  id: string;
  name: string;
  governingLaw: string;
  category: "civil" | "family";
}

export const CIVIL_CASE_TYPES: CaseType[] = [
  {
    id: "civil_1",
    name: "Suit for Recovery of Money",
    governingLaw: "Civil Procedure Code (CPC), 1908",
    category: "civil",
  },
  {
    id: "civil_2",
    name: "Suit for Permanent Injunction",
    governingLaw: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "civil_3",
    name: "Suit for Declaration",
    governingLaw: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "civil_4",
    name: "Suit for Specific Performance of Agreement",
    governingLaw: "Specific Relief Act, 1877",
    category: "civil",
  },
  {
    id: "civil_5",
    name: "Suit for Possession of Property",
    governingLaw: "Civil Procedure Code (CPC), 1908",
    category: "civil",
  },
];

export const FAMILY_CASE_TYPES: CaseType[] = [
  {
    id: "family_1",
    name: "Khula (Wife's Judicial Divorce)",
    governingLaw: "Dissolution of Muslim Marriages Act, 1939 & MFLO, 1961",
    category: "family",
  },
  {
    id: "family_2",
    name: "Maintenance (Wife & Children)",
    governingLaw: "MFLO, 1961 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "family_3",
    name: "Recovery of Dowry Articles / Personal Property",
    governingLaw: "Dowry & Bridal Gifts Act, 1976 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "family_4",
    name: "Custody of Minors (Hizanat)",
    governingLaw: "Guardian and Wards Act, 1890 & Family Courts Act, 1964",
    category: "family",
  },
  {
    id: "family_5",
    name: "Restitution of Conjugal Rights",
    governingLaw: "Family Courts Act, 1964",
    category: "family",
  },
];

export const ALL_CASE_TYPES = [...CIVIL_CASE_TYPES, ...FAMILY_CASE_TYPES];
