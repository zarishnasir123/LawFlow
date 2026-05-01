export function getSupportedTehsils() {
  return String(process.env.SUPPORTED_TEHSILS || "Gujranwala")
    .split(",")
    .map((tehsil) => tehsil.trim().toLowerCase())
    .filter(Boolean);
}

export function isSupportedTehsil(tehsil) {
  if (!tehsil) {
    return true;
  }

  return getSupportedTehsils().includes(String(tehsil).trim().toLowerCase());
}
