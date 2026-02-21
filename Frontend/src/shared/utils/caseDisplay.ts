function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCaseDisplayTitle(
  title?: string | null,
  caseId?: string | null
): string {
  const trimmedTitle = (title || "").trim();
  if (!trimmedTitle) return "Case File";

  const normalizedTitle = normalizeValue(trimmedTitle);
  const normalizedCaseId = normalizeValue(caseId || "");

  if (normalizedCaseId && normalizedTitle === `case ${normalizedCaseId}`) {
    return "Case File";
  }

  const randomCasePatterns = [
    /^case\s+\d{8,}(?:\s+[a-z0-9]{3,})?$/i,
    /^case\s+[a-z0-9]{10,}$/i,
  ];
  if (randomCasePatterns.some((pattern) => pattern.test(trimmedTitle))) {
    return "Case File";
  }

  return trimmedTitle;
}

