import { apiClient } from "../../../shared/api/axios";
import type { Hearing } from "../../registrar/api";

export const lawyerHearingsApi = {
  listMyHearings: async (): Promise<Hearing[]> => {
    const { data } = await apiClient.get<{ hearings: Hearing[] }>("/hearings/my");
    return data.hearings;
  },
  
  listCaseHearings: async (caseId: string): Promise<Hearing[]> => {
    const { data } = await apiClient.get<{ hearings: Hearing[] }>(`/hearings/cases/${caseId}`);
    return data.hearings;
  }
};
