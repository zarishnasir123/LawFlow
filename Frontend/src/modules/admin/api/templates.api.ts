// src/modules/admin/api/templates.api.ts

import { templatesStore } from "../data/templates.store";
import type { Template } from "../data/templates.store";

export const TemplatesAPI = {
  getAll: async (): Promise<Template[]> => {
    return templatesStore;
  },

  create: async (data: Template) => {
    templatesStore.push(data);
  },

  update: async (id: number, data: Partial<Template>) => {
    const t = templatesStore.find((x) => x.id === id);
    if (t) Object.assign(t, data);
  },

  delete: async (id: number) => {
    const index = templatesStore.findIndex((x) => x.id === id);
    if (index !== -1) templatesStore.splice(index, 1);
  },
};
