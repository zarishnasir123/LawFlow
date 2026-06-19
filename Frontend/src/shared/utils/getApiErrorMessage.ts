// Pull a human-readable message out of an axios error (our backend always
// returns { message } on failures), falling back to a friendly default.
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response?: { data?: { message?: string } } })
      .response;
    if (resp?.data?.message) return resp.data.message;
  }
  return fallback;
}
