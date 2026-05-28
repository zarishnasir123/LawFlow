// Tehsils accepted by the registrar/lawyer assignment flows. The
// admin's "Create Registrar" form renders a dropdown built from this
// same list (mirrored on the frontend), so changing this default
// is the single switch that adds a new jurisdiction to the deployment.
// The bare "Gujranwala" entry stays in the list for backwards
// compatibility with existing client_profiles rows that were stamped
// with the wider district name before the per-tehsil breakdown
// existed.
export function getSupportedTehsils() {
  return String(
    process.env.SUPPORTED_TEHSILS ||
      "Gujranwala,Gujranwala City & Sadar,Kamoke,Nowshera Virkan"
  )
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

// Best-effort parser that pulls (city, tehsil) out of a freeform
// address string. Used so the client only has to type their address
// once — the profile derives the structured columns without an extra
// form field.
//
// Heuristics:
//   - city  = the last non-empty comma-separated segment, trimmed.
//             Pakistani addresses conventionally end with the city
//             ("..., Gali no 3, band Gali, Gujranwala"), so this is
//             accurate the vast majority of the time.
//   - tehsil = if any SUPPORTED_TEHSILS name appears anywhere in
//              the address (case-insensitive whole-word match), use
//              that. Otherwise null. Done as a whole-word match so a
//              tehsil that's a substring of an unrelated word doesn't
//              false-match.
//
// Both fields return null when the input is empty / no match — the
// caller writes null straight into client_profiles.{city,tehsil}.
export function deriveLocationFromAddress(address) {
  if (typeof address !== "string" || !address.trim()) {
    return { city: null, tehsil: null };
  }

  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const city = segments.length > 0 ? segments[segments.length - 1] : null;

  let tehsil = null;
  const lowerAddress = address.toLowerCase();
  for (const candidate of getSupportedTehsils()) {
    // Whole-word match: "lahore" inside "lahori" shouldn't count.
    const wordRegex = new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (wordRegex.test(lowerAddress)) {
      // Title-case for storage so it renders cleanly on the profile
      // page without an extra capitalize step at every read.
      tehsil = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      break;
    }
  }

  return { city, tehsil };
}
