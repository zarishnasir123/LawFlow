const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "1") return false;
  return UUID_REGEX.test(trimmed);
}
