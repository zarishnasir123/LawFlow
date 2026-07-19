import { describe, it, expect } from "vitest";
import {
  orderBundleDocuments,
  buildSignatureSnapshot,
  validateCaseBundle,
} from "./caseFiling.utils";
import type {
  BundleDocument,
  CompiledCaseBundle,
  FilingCaseRecord,
} from "../types/caseFiling";

const doc = (over: Partial<BundleDocument> = {}): BundleDocument =>
  ({
    id: "d1",
    title: "Document",
    category: "supporting",
    fileType: "docx",
    required: true,
    signedRequired: false,
    signedCompleted: false,
    source: "prepared_document",
    ...over,
  }) as BundleDocument;

describe("orderBundleDocuments", () => {
  it("orders by category (petition → supporting → evidence → summary)", () => {
    const out = orderBundleDocuments([
      doc({ id: "sum", category: "signature_summary", title: "Summary" }),
      doc({ id: "ev", category: "evidence", title: "Evidence" }),
      doc({ id: "pet", category: "petition", title: "Plaint" }),
    ]);
    expect(out.map((d) => d.id)).toEqual(["pet", "ev", "sum"]);
  });

  it("orders by title keyword priority within a category", () => {
    const out = orderBundleDocuments([
      doc({ id: "annex", category: "petition", title: "Annexure A" }),
      doc({ id: "plaint", category: "petition", title: "Plaint" }),
      doc({ id: "aff", category: "petition", title: "Affidavit" }),
    ]);
    expect(out.map((d) => d.id)).toEqual(["plaint", "aff", "annex"]);
  });
});

describe("buildSignatureSnapshot", () => {
  it("counts only signature-required documents", () => {
    const snap = buildSignatureSnapshot([
      doc({ signedRequired: true, signedCompleted: true }),
      doc({ signedRequired: true, signedCompleted: false }),
      doc({ signedRequired: false }),
    ]);
    expect(snap.totalRequired).toBe(2);
    expect(snap.completed).toBe(1);
    expect(snap.pending).toBe(1);
    expect(snap.allCompleted).toBe(false);
  });

  it("is allCompleted when nothing needs signing", () => {
    const snap = buildSignatureSnapshot([doc({ signedRequired: false })]);
    expect(snap.allCompleted).toBe(true);
  });
});

describe("validateCaseBundle", () => {
  const filingCase = (over: Partial<FilingCaseRecord> = {}): FilingCaseRecord =>
    ({
      id: "c1",
      displayCaseId: "C-1",
      title: "Suit",
      caseType: "civil",
      clientName: "Ali",
      assignedTehsil: "Gujranwala",
      assignedRegistrar: "Reg 1",
      casePrepared: true,
      requiredDocumentKeywords: ["plaint"],
      status: "draft",
      createdAt: "",
      updatedAt: "",
      ...over,
    }) as FilingCaseRecord;

  const bundle = (docs: BundleDocument[], allSigned = true): CompiledCaseBundle =>
    ({
      caseId: "c1",
      generatedAt: "",
      orderedDocuments: docs,
      evidenceFiles: [],
      signatureSnapshot: {
        totalRequired: allSigned ? 0 : 1,
        completed: 0,
        pending: allSigned ? 0 : 1,
        allCompleted: allSigned,
        items: [],
      },
    }) as CompiledCaseBundle;

  it("is ready when documents, signatures, prep, and registrar all check out", () => {
    const result = validateCaseBundle(
      filingCase(),
      bundle([doc({ title: "Plaint document" })])
    );
    expect(result.isReady).toBe(true);
    expect(result.missingItems).toHaveLength(0);
  });

  it("flags missing required documents", () => {
    const result = validateCaseBundle(
      filingCase({ requiredDocumentKeywords: ["vakalatnama"] }),
      bundle([doc({ title: "Plaint document" })])
    );
    expect(result.requiredDocumentsPresent).toBe(false);
    expect(result.isReady).toBe(false);
    expect(result.missingItems.join(" ")).toMatch(/vakalatnama/);
  });

  it("flags incomplete signatures, missing prep, and missing registrar", () => {
    const result = validateCaseBundle(
      filingCase({ casePrepared: false, assignedRegistrar: "  " }),
      bundle([doc({ title: "Plaint document" })], false)
    );
    expect(result.requiredSignaturesCompleted).toBe(false);
    expect(result.casePrepared).toBe(false);
    expect(result.registrarAssigned).toBe(false);
    expect(result.isReady).toBe(false);
    expect(result.missingItems.length).toBeGreaterThanOrEqual(3);
  });
});
