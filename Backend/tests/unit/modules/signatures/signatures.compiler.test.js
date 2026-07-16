import { describe, it, expect, beforeEach, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

// Plain-closure fakes for the compiler's three seams: the DB pool, the
// storage upload, and the audit-event writer. No real Postgres/Supabase.
let queryScript = [];
let queryCalls = [];
let uploadCalls = [];
let eventCalls = [];

vi.mock("../../../../src/config/db.js", () => ({
  pool: {
    query(sql, params) {
      queryCalls.push({ sql, params });
      const step = queryScript.shift();
      return Promise.resolve(step ?? { rows: [] });
    },
  },
}));

vi.mock("../../../../src/services/storage.service.js", () => ({
  uploadSignedCasePdf(args) {
    uploadCalls.push(args);
    return Promise.resolve({ storagePath: "lawyers/key-1/cases/c-1/signed.pdf" });
  },
}));

vi.mock("../../../../src/modules/cases/caseEvents.service.js", () => ({
  safeRecordCaseEvent(args) {
    eventCalls.push(args);
    return Promise.resolve();
  },
}));

const { compileCaseSignedPdf } = await import(
  "../../../../src/modules/signatures/signatures.compiler.js"
);

// Canonical 1x1 transparent PNG.
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const signedRow = (captures, signedAt = "2026-07-16T10:00:00Z") => ({
  id: "req-1",
  signed_at: signedAt,
  signed_page_images: captures,
});

beforeEach(() => {
  queryScript = [];
  queryCalls = [];
  uploadCalls = [];
  eventCalls = [];
});

describe("compileCaseSignedPdf", () => {
  it("glues the captured pages into a real PDF, uploads it, and records the path + audit event", async () => {
    queryScript = [
      { rows: [signedRow([{ pageIndex: 0, imageDataUrl: PNG_DATA_URL }])] },
      { rows: [] }, // the UPDATE cases … query
    ];

    const result = await compileCaseSignedPdf({ caseId: "c-1", lawyerUserId: "u-1" });
    expect(result.storagePath).toBe("lawyers/key-1/cases/c-1/signed.pdf");

    // A genuine one-page PDF was produced and uploaded.
    expect(uploadCalls).toHaveLength(1);
    const pdf = await PDFDocument.load(uploadCalls[0].pdfBuffer);
    expect(pdf.getPageCount()).toBe(1);

    // The case row was stamped with the storage path…
    const update = queryCalls.find((c) => c.sql.includes("UPDATE cases"));
    expect(update.params[0]).toBe("lawyers/key-1/cases/c-1/signed.pdf");
    // …and the audit trail recorded the compile on the lawyer's behalf.
    expect(eventCalls[0]).toMatchObject({
      caseId: "c-1",
      eventType: "signed_pdf_compiled",
      actorRole: "lawyer",
    });
  });

  it("orders multi-page captures by absolute page index", async () => {
    queryScript = [
      {
        rows: [
          signedRow([
            { pageIndex: 2, imageDataUrl: PNG_DATA_URL },
            { pageIndex: 0, imageDataUrl: PNG_DATA_URL },
            { pageIndex: 1, imageDataUrl: PNG_DATA_URL },
          ]),
        ],
      },
      { rows: [] },
    ];

    await compileCaseSignedPdf({ caseId: "c-1", lawyerUserId: "u-1" });
    const pdf = await PDFDocument.load(uploadCalls[0].pdfBuffer);
    expect(pdf.getPageCount()).toBe(3);
  });

  it("keeps ONE capture per page when signers co-signed the same page (freshest wins)", async () => {
    // Rows arrive signed_at DESC — the first row is the latest signer.
    queryScript = [
      {
        rows: [
          signedRow([{ pageIndex: 0, imageDataUrl: PNG_DATA_URL }], "2026-07-16T12:00:00Z"),
          signedRow([{ pageIndex: 0, imageDataUrl: PNG_DATA_URL }], "2026-07-16T09:00:00Z"),
        ],
      },
      { rows: [] },
    ];

    await compileCaseSignedPdf({ caseId: "c-1", lawyerUserId: "u-1" });
    const pdf = await PDFDocument.load(uploadCalls[0].pdfBuffer);
    expect(pdf.getPageCount()).toBe(1); // not two pages for the same index
  });

  it("accepts captures stored as a JSON string (jsonb column round trip)", async () => {
    queryScript = [
      { rows: [signedRow(JSON.stringify([{ pageIndex: 0, imageDataUrl: PNG_DATA_URL }]))] },
      { rows: [] },
    ];

    await compileCaseSignedPdf({ caseId: "c-1", lawyerUserId: "u-1" });
    expect(uploadCalls).toHaveLength(1);
  });

  it("throws when the case has no signed requests at all", async () => {
    queryScript = [{ rows: [] }];
    await expect(compileCaseSignedPdf({ caseId: "c-1", lawyerUserId: "u-1" })).rejects.toThrow(
      /No signed signature requests/
    );
    expect(uploadCalls).toHaveLength(0);
  });

  it("throws a clear legacy-flow error when no row carries page captures", async () => {
    queryScript = [{ rows: [signedRow(null), signedRow(null)] }];
    await expect(compileCaseSignedPdf({ caseId: "c-1", lawyerUserId: "u-1" })).rejects.toThrow(
      /legacy flow/
    );
  });
});
