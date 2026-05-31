/** Keep only digits so "05000" cannot form while typing. */
export function sanitizeFeeDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function feeDigitsToNumber(digits: string): number | undefined {
  if (digits === "") return undefined;
  const value = Number(digits);
  return Number.isFinite(value) ? value : undefined;
}

export function feeNumberToDigits(value: number | undefined): string {
  if (value === undefined || value === null) return "";
  return String(value);
}
