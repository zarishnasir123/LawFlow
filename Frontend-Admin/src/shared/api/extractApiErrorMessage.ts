import { AxiosError } from "axios";

/**
 * Pulls a human-readable error message out of any Axios error thrown by an
 * apiClient call, falling back to a caller-supplied default if the response
 * shape isn't recognisable. Handles both the `{ message }` shape used by
 * single-error endpoints and the `{ errors: [{ msg }] }` shape produced by
 * express-validator chains on the backend.
 */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { message?: string; errors?: Array<{ msg?: string }> }
      | undefined;
    if (data?.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
