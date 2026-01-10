import axios from "axios";
import { apiClient } from "../../shared/api/axios";

export const authApi = apiClient;

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message
    );
  }

  return "Unexpected error. Please try again.";
}
