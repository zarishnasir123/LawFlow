// Pakistani phone + CNIC input formatting (masking) + the Gujranwala CNIC
// allow-list. Used so users only type digits — the "+92-" prefix and the CNIC
// dashes are inserted automatically. The backend stays the authoritative gate;
// isAllowedGujranwalaCnic just gives instant client-side feedback.

// The four Gujranwala tehsils the app serves (dropdown source).
export const GUJRANWALA_TEHSILS = [
  "Gujranwala City & Sadar",
  "Kamoke",
  "Nowshera Virkan",
  "Wazirabad",
] as const;

// Allowed CNIC first-5-digit locality codes (must match the backend
// ALLOWED_CNIC_PREFIXES): Gujranwala City/Saddar, Kamoke, Nowshera Virkan, Wazirabad.
export const ALLOWED_CNIC_PREFIXES = [
  "34101",
  "34102",
  "34103",
  "34104",
  "34105",
  "34106",
];

// Format a partial CNIC as the user types: digits only, dashes auto-inserted at
// positions 5 and 12 → "XXXXX-XXXXXXX-X" (max 13 digits).
export function formatCnic(input: string): string {
  const digits = String(input || "").replace(/\D/g, "").slice(0, 13);
  let out = digits.slice(0, 5);
  if (digits.length > 5) out += "-" + digits.slice(5, 12);
  if (digits.length > 12) out += "-" + digits.slice(12, 13);
  return out;
}

// --- CNIC skeleton-mask helpers (fixed template input: _____-_______-_) ---

// Just the digits of a CNIC, capped at 13 (5 + 7 + 1).
export function cnicDigits(input: string): string {
  return String(input || "").replace(/\D/g, "").slice(0, 13);
}

// The fixed skeleton the CNIC box always shows: typed digits fill the slots
// left-to-right, empty slots show "_", and the two dashes never move.
// e.g. "" -> "_____-_______-_", "34104" -> "34104-_______-_".
export function cnicSkeleton(digits: string): string {
  const slot = (i: number) => (i < digits.length ? digits[i] : "_");
  let g1 = "";
  for (let i = 0; i < 5; i++) g1 += slot(i);
  let g2 = "";
  for (let i = 5; i < 12; i++) g2 += slot(i);
  return `${g1}-${g2}-${slot(12)}`;
}

// Caret index (into the skeleton) that sits right after the last typed digit —
// i.e. on the next empty slot — so entry stays strictly left-to-right.
export function cnicCaretPos(digitCount: number): number {
  if (digitCount <= 4) return digitCount; // within the first 5-digit group
  if (digitCount <= 11) return digitCount + 1; // past the first dash
  if (digitCount === 12) return 14; // on the final single-digit slot
  return 15; // complete — caret at the end
}

// Format a Pakistani mobile number with a fixed "+92-" prefix. Accepts the user
// pasting 0300…, 92300…, +92300…, or just 300… — strips a leading 92 then a
// leading 0, keeps 10 local digits, groups as "+92-3XX-XXXXXXX". Returns "+92-"
// when empty so the prefix is always visible.
export function formatPkPhone(input: string): string {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let local = digits.slice(0, 3);
  if (digits.length > 3) local += "-" + digits.slice(3, 10);
  return "+92-" + local;
}

// True when the CNIC's first 5 digits are one of the allowed Gujranwala codes.
export function isAllowedGujranwalaCnic(cnic: string): boolean {
  const prefix = String(cnic || "").replace(/\D/g, "").slice(0, 5);
  return ALLOWED_CNIC_PREFIXES.includes(prefix);
}
