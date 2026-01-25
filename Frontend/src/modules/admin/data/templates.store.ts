export type Template = {
  id: number;
  name: string;
  category: string;
  description: string;
  lastModified: string;
  usageCount: number;
  fileSize: string;
};

export const templatesStore: Template[] = [
  {
    id: 1,
    name: "Civil Suit Template",
    category: "Civil",
    description: "Standard template for civil litigation cases",
    lastModified: "Mar 15, 2024",
    usageCount: 234,
    fileSize: "45 KB",
  },
  {
    id: 2,
    name: "Family Court Petition",
    category: "Family",
    description: "Template for family court petitions",
    lastModified: "Feb 28, 2024",
    usageCount: 156,
    fileSize: "42 KB",
  },
];
