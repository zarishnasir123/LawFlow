import type {
  BundleDocument,
  CompiledCaseBundle,
  FilingCaseRecord,
  FilingValidationChecklist,
  SignatureCompletionSnapshot,
} from "../types/caseFiling";

const categoryOrder: Record<BundleDocument["category"], number> = {
  petition: 1,
  supporting: 2,
  evidence: 3,
  signature_summary: 4,
};

const titlePriorityKeywords = [
  "petition",
  "plaint",
  "affidavit",
  "vakalatnama",
  "witness",
  "annexure",
];

function getTitlePriority(title: string): number {
  const normalized = title.toLowerCase();
  const index = titlePriorityKeywords.findIndex((keyword) =>
    normalized.includes(keyword)
  );
  return index === -1 ? 100 : index;
}

export function orderBundleDocuments(documents: BundleDocument[]): BundleDocument[] {
  return [...documents].sort((a, b) => {
    const categoryDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (categoryDiff !== 0) return categoryDiff;

    const titleDiff = getTitlePriority(a.title) - getTitlePriority(b.title);
    if (titleDiff !== 0) return titleDiff;

    return a.title.localeCompare(b.title);
  });
}

export function buildSignatureSnapshot(
  documents: BundleDocument[]
): SignatureCompletionSnapshot {
  const items = documents
    .filter((doc) => doc.signedRequired)
    .map((doc) => ({
      id: doc.id,
      documentTitle: doc.title,
      required: true,
      completed: doc.signedCompleted,
    }));

  const totalRequired = items.length;
  const completed = items.filter((item) => item.completed).length;
  const pending = Math.max(0, totalRequired - completed);

  return {
    totalRequired,
    completed,
    pending,
    allCompleted: totalRequired === 0 ? true : pending === 0,
    items,
  };
}

export function validateCaseBundle(
  filingCase: FilingCaseRecord,
  bundle: CompiledCaseBundle
): FilingValidationChecklist {
  const orderedDocuments = orderBundleDocuments(bundle.orderedDocuments);
  const documentTitles = orderedDocuments.map((doc) => doc.title.toLowerCase());

  const missingRequiredKeywords = filingCase.requiredDocumentKeywords.filter(
    (keyword) => !documentTitles.some((title) => title.includes(keyword.toLowerCase()))
  );

  const requiredDocumentsPresent = missingRequiredKeywords.length === 0;
  const requiredSignaturesCompleted = bundle.signatureSnapshot.allCompleted;
  const casePrepared = filingCase.casePrepared;
  const registrarAssigned = Boolean(
    filingCase.assignedRegistrar.trim() && filingCase.assignedTehsil.trim()
  );

  const missingItems: string[] = [];
  if (!requiredDocumentsPresent) {
    missingItems.push(
      `Missing required documents: ${missingRequiredKeywords.join(", ")}.`
    );
  }
  if (!requiredSignaturesCompleted) {
    missingItems.push("Required signatures are not fully completed.");
  }
  if (!casePrepared) {
    missingItems.push("Case file is not marked as prepared.");
  }
  if (!registrarAssigned) {
    missingItems.push("Assigned registrar/tehsil is missing.");
  }

  return {
    requiredDocumentsPresent,
    requiredSignaturesCompleted,
    casePrepared,
    registrarAssigned,
    missingItems,
    isReady:
      requiredDocumentsPresent &&
      requiredSignaturesCompleted &&
      casePrepared &&
      registrarAssigned,
  };
}

export function formatFilingDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
