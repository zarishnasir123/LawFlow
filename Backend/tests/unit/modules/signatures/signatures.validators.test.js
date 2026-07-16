import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  createSignatureRequestValidator,
  submitSignatureValidator,
  saveEditedDocumentValidator,
} from "../../../../src/modules/signatures/signatures.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

describe("createSignatureRequestValidator", () => {
  const valid = () => ({
    params: { caseId: UUID },
    body: { pageAssignments: [{ pageIndex: 0, signers: ["client", "lawyer"] }] },
  });

  it("accepts a valid page-assignment batch", async () => {
    expect((await runValidators(createSignatureRequestValidator, makeReq(valid()))).isEmpty()).toBe(true);
  });

  it("requires a non-empty pageAssignments array", async () => {
    const req = makeReq(valid());
    req.body.pageAssignments = [];
    expect(messagesOf(await runValidators(createSignatureRequestValidator, req))).toContain(
      "pageAssignments must be a non-empty array"
    );
  });

  it("rejects negative page indexes and empty signer lists", async () => {
    let req = makeReq(valid());
    req.body.pageAssignments = [{ pageIndex: -1, signers: ["client"] }];
    expect(messagesOf(await runValidators(createSignatureRequestValidator, req))).toContain(
      "Each pageAssignment.pageIndex must be a non-negative integer"
    );

    req = makeReq(valid());
    req.body.pageAssignments = [{ pageIndex: 0, signers: [] }];
    expect(messagesOf(await runValidators(createSignatureRequestValidator, req))).toContain(
      "Each pageAssignment must list at least one signer"
    );
  });

  it("only allows client/lawyer as signers (no registrar or admin)", async () => {
    const req = makeReq(valid());
    req.body.pageAssignments = [{ pageIndex: 0, signers: ["client", "registrar"] }];
    expect(messagesOf(await runValidators(createSignatureRequestValidator, req))).toContain(
      "signers must be a subset of ['client', 'lawyer']"
    );
  });

  it("validates the optional client email", async () => {
    const req = makeReq(valid());
    req.body.clientEmail = "not-an-email";
    expect(messagesOf(await runValidators(createSignatureRequestValidator, req))).toContain(
      "clientEmail must be a valid email address"
    );
  });
});

describe("submitSignatureValidator", () => {
  it("accepts a PNG data-URL signature", async () => {
    const result = await runValidators(
      submitSignatureValidator,
      makeReq({ params: { requestId: UUID }, body: { signatureImage: PNG_DATA_URL } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("rejects a non-image payload (the endpoint is not a blob-upload channel)", async () => {
    for (const bad of ["hello", "data:text/plain;base64,aGk=", ""]) {
      const result = await runValidators(
        submitSignatureValidator,
        makeReq({ params: { requestId: UUID }, body: { signatureImage: bad } })
      );
      expect(messagesOf(result).join(" "), JSON.stringify(bad)).toMatch(/PNG\/JPEG data URL|required/);
    }
  });

  it("validates each signed-page capture when present", async () => {
    const result = await runValidators(
      submitSignatureValidator,
      makeReq({
        params: { requestId: UUID },
        body: {
          signatureImage: PNG_DATA_URL,
          signedPages: [{ pageIndex: -2, imageDataUrl: "not-a-data-url" }],
        },
      })
    );
    const messages = messagesOf(result);
    expect(messages).toContain("signedPages[].pageIndex must be a non-negative integer");
    expect(messages).toContain("signedPages[].imageDataUrl must be a PNG/JPEG data URL");
  });
});

describe("saveEditedDocumentValidator", () => {
  it("requires editedHtml to be a string", async () => {
    const bad = await runValidators(
      saveEditedDocumentValidator,
      makeReq({ params: { caseId: UUID }, body: { editedHtml: 42 } })
    );
    expect(messagesOf(bad)).toContain("editedHtml is required");

    const ok = await runValidators(
      saveEditedDocumentValidator,
      makeReq({ params: { caseId: UUID }, body: { editedHtml: "<section class='docx'>…</section>" } })
    );
    expect(ok.isEmpty()).toBe(true);
  });
});
