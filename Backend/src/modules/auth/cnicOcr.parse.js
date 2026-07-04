// Pure CNIC extraction/parsing helpers for OCR. Shared by the service and
// local verifyChunk scripts — no Gemini or DB dependencies.

// Matches a 13-digit Pakistani CNIC with optional dashes: 34101-9721875-9
// Also matches the dashless form: 3410197218759
export const CNIC_PATTERN = /\d{5}-?\d{7}-?\d{1}/;

// Formats a 13-digit string as XXXXX-XXXXXXX-X for display.
export function formatCnic(digits) {
  if (digits.length !== 13) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

// Strips dashes from a CNIC for digit-only comparison.
export function stripDashes(cnic) {
  return String(cnic || "").replace(/-/g, "");
}

// Attempts to extract a CNIC from the OCR response text.
// Returns { readable: true, digits, formatted } or { readable: false }.
export function parseOcrResponse(text) {
  const cleaned = String(text || "").trim();

  if (cleaned === "NOT_FOUND" || !cleaned) {
    return { readable: false, digits: null, formatted: null };
  }

  const match = cleaned.match(CNIC_PATTERN);
  if (!match) {
    return { readable: false, digits: null, formatted: null };
  }

  const digits = stripDashes(match[0]);
  if (digits.length !== 13) {
    return { readable: false, digits: null, formatted: null };
  }

  return { readable: true, digits, formatted: formatCnic(digits) };
}
