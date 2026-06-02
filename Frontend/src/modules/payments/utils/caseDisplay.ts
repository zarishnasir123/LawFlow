/** Lawyer-entered case title from cases.title (Create Case form). */
export function formatCaseTitle(input: {
  caseTitle?: string | null;
  caseTypeName?: string | null;
  clientName?: string | null;
}): string {
  const title = input.caseTitle?.trim() || "";
  const type = input.caseTypeName?.trim() || "";

  if (title) return title;
  if (type) return type;
  return input.clientName?.trim() || "Case";
}

/** Dropdown / compact list: your title + defined case type. */
export function formatCaseSelectLabel(input: {
  caseTitle?: string | null;
  caseTypeName?: string | null;
  clientName?: string | null;
}): string {
  const title = input.caseTitle?.trim() || "";
  const type = input.caseTypeName?.trim() || "";

  if (title && type) return `${title} · ${type}`;
  return formatCaseTitle(input);
}
