const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;

export function normalizeCnic(cnic) {
  return String(cnic || "").trim();
}

export function isValidPakistanCnic(cnic) {
  const normalized = normalizeCnic(cnic);

  if (!cnicPattern.test(normalized)) {
    return false;
  }

  const digitsOnly = normalized.replaceAll("-", "");

  // CNIC has no public checksum, so reject only obvious fake values here.
  if (/^(\d)\1{12}$/.test(digitsOnly)) {
    return false;
  }

  return true;
}

export function getAllowedCnicPrefixes() {
  // Defaults to the Gujranwala tehsil locality codes (Gujranwala City/Saddar,
  // Kamoke, Nowshera Virkan, Wazirabad) so the restriction is ON out of the box
  // even when ALLOWED_CNIC_PREFIXES is unset/blank. Override via the env var.
  return String(
    process.env.ALLOWED_CNIC_PREFIXES ||
      "34101,34102,34103,34104,34105,34106"
  )
    .split(",")
    .map((prefix) => prefix.trim())
    .filter(Boolean);
}

export function isAllowedDistrictCnic(cnic) {
  const allowedPrefixes = getAllowedCnicPrefixes();

  if (allowedPrefixes.length === 0) {
    return true;
  }

  const normalized = normalizeCnic(cnic);
  return allowedPrefixes.some((prefix) => normalized.startsWith(prefix));
}
