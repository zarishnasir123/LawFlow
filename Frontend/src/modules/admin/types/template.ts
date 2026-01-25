// src/modules/admin/types/template.ts

export type Template = {
  id: number;
  name: string;
  category: "Civil" | "Family" | string;
  description: string;
  lastModified: string;
  usageCount: number;
  fileSize: string;
};
