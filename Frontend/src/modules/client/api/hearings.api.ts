import { apiClient } from "../../../shared/api/axios";
import type { Hearing } from "../../registrar/api";

export const clientHearingsApi = {
  listMyHearings: async (): Promise<Hearing[]> => {
    const { data } = await apiClient.get<{ hearings: Hearing[] }>("/hearings/my/client");
    return data.hearings;
  }
};
