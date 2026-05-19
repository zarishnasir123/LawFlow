// Generates the Pakistani court-plaint .docx templates used by Module 3
// (Online Document Editing and Digital Case File PDF Preparation).
//
// Run after `npm install`:
//   npm run generate:case-templates
//
// Output layout (mirrors the case_types.code in the DB seed):
//   ../services/case-templates/
//       civil/
//           civil_declaration.docx
//           (4 more pending: recovery_of_money, permanent_injunction,
//            specific_performance, possession_of_property)
//       family/
//           family_khula.docx
//           family_maintenance.docx          ← maintenance only
//           family_dowry_recovery.docx       ← dowry only
//           (2 more pending: minor_custody, conjugal_rights)
//
// Currently 4 of 10 templates are filled in — these are the ones the consulted
// advocate provided as reference drafts. The remaining 6 follow once we have
// equivalent reference drafts.
//
// Drafting authorities (cited per template in code + in LEGAL-BASIS.md):
//   • D.F. Mulla, The Code of Civil Procedure (universal CPC commentary)
//   • Tanzil-ur-Rahman, A Code of Muslim Personal Law, Vol I & II
//   • Aamer Raza A. Khan, Drafting, Pleadings & Conveyancing
//   • Manzoor Hussain Sial, Drafting & Pleadings
//   • Mulla (Hidayatullah ed.), Principles of Mahomedan Law
//
// Section headings in each .docx are marked as Heading 1 so Word's
// Navigation Pane shows them in the sidebar — and so mammoth converts them
// to <h1> when loading into our Tiptap editor (Phase 2). They're styled
// small, italic, gray so they look like dividers rather than competing
// with the plaint body.
//
// Signature placeholders are explicit lines marked "[DIGITAL SIGNATURE — ROLE]"
// so future digital-signature integration (Module 4 territory) has clear
// anchor points. For now the lawyer fills them by hand-signing the printed
// copy.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(here, "..", "services", "case-templates");
const CIVIL_DIR = path.join(OUTPUT_DIR, "civil");
const FAMILY_DIR = path.join(OUTPUT_DIR, "family");

// ──────────────────────────────────────────────────────────────────────────
// Formatting constants — Pakistani court-plaint convention:
// Times New Roman 12pt body, 14pt headings, 1″ margins, 1.5 line spacing.
// ──────────────────────────────────────────────────────────────────────────
const FONT = "Times New Roman";
const BODY_SIZE = 24; // 12pt (docx half-points)
const HEADING_SIZE = 28; // 14pt
const SUBHEADING_SIZE = 26; // 13pt
const SECTION_HEADING_SIZE = 20; // 10pt — small, gray dividers
const LINE_SPACING = 360; // 1.5 (240 = single)
const PAGE_MARGIN_TWIPS = 1440; // 1 inch
const PARA_AFTER = 200;
const SECTION_GRAY = "666666";

// ──────────────────────────────────────────────────────────────────────────
// Low-level paragraph helpers
// ──────────────────────────────────────────────────────────────────────────
function run(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? BODY_SIZE,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color,
    underline: opts.underline ? {} : undefined,
    break: opts.break ?? 0
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { line: LINE_SPACING, after: opts.after ?? PARA_AFTER },
    indent: opts.indent,
    children: Array.isArray(children) ? children : [children]
  });
}

function blank(after = 100) {
  return new Paragraph({
    spacing: { line: LINE_SPACING, after },
    children: [run("")]
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function centeredHeading(text, opts = {}) {
  return para(
    run(text, {
      bold: true,
      size: opts.size ?? HEADING_SIZE,
      underline: opts.underline ?? false
    }),
    { alignment: AlignmentType.CENTER, after: opts.after ?? 200 }
  );
}

function centeredText(text, opts = {}) {
  return para(run(text, opts), {
    alignment: AlignmentType.CENTER,
    after: opts.after ?? PARA_AFTER
  });
}

function rightAligned(text, opts = {}) {
  return para(run(text, opts), { alignment: AlignmentType.RIGHT });
}

function numberedPara(number, text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE_SPACING, after: 200 },
    indent: { left: 720, hanging: 360 },
    children: [
      run(`${number}. `),
      ...(Array.isArray(text) ? text : [run(text)])
    ]
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Navigation: section heading (Heading 1) — appears in Word's Nav Pane and
// in our editor's sidebar via mammoth → <h1>. Styled small + italic + gray
// so it reads as a divider, not a competing body heading.
// ──────────────────────────────────────────────────────────────────────────
function sectionHeading(label) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING, before: 200, after: 200 },
    children: [
      new TextRun({
        text: `─── ${label} ───`,
        font: FONT,
        size: SECTION_HEADING_SIZE,
        bold: true,
        italics: true,
        color: SECTION_GRAY
      })
    ]
  });
}

// In-document instruction to the drafting lawyer — italic gray text that
// reads as a clear "lawyer-fills-this" marker.
function lawyerNote(text) {
  return para(
    run(text, { italics: true, color: SECTION_GRAY, size: 22 }),
    { alignment: AlignmentType.LEFT }
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Signature block — renders as a natural document-style signature line, ready
// for hand-signing on a printed plaint or for e-signature insertion later:
//
//   Signature: ____________________________________
//
//   Name:  [insert ...]
//   Date:  ____________________
//
//   (Role)
//
// Left-aligned to match the inline conventions of modern Pakistani court
// drafts (right-alignment was the old paper-form convention).
// ──────────────────────────────────────────────────────────────────────────
function signaturePlaceholder({ role, namePlaceholder, dateLine = "____________________" }) {
  return [
    blank(200),
    para([
      run("Signature: ", { bold: true }),
      run("____________________________________")
    ]),
    blank(40),
    para([run("Name:  ", { bold: true }), run(namePlaceholder)]),
    para([run("Date:  ", { bold: true }), run(dateLine)]),
    blank(40),
    para(
      run(`(${role})`, { italics: true, color: SECTION_GRAY, size: 22 }),
      { alignment: AlignmentType.LEFT }
    )
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// Reusable structural blocks
// ──────────────────────────────────────────────────────────────────────────

// Cause Title: "IN THE COURT OF ..." + suit number. CPC Order VII Rule 1(a).
function causeTitle({ courtLine, suitNumberLine }) {
  return [
    centeredHeading(courtLine, { size: HEADING_SIZE }),
    centeredHeading(suitNumberLine, { size: SUBHEADING_SIZE }),
    blank()
  ];
}

// Parties block. CPC Order VII Rule 1(b), 1(c).
function partiesBlock({ plaintiffLines, defendantLines }) {
  const out = [];
  for (const line of plaintiffLines) out.push(para(run(line)));
  out.push(rightAligned("... Plaintiff", { bold: true }));
  out.push(blank(120));
  out.push(centeredText("Versus", {}));
  out.push(blank(120));
  for (const line of defendantLines) out.push(para(run(line)));
  out.push(rightAligned("... Defendant", { bold: true }));
  out.push(blank());
  return out;
}

function subjectLine(text) {
  return centeredHeading(text, { underline: true, size: HEADING_SIZE });
}

// Combined Plaintiff + Counsel signature block for end-of-page signing.
// Counsel section carries the full identity fields a Pakistani court expects
// on a properly-filed plaint: Bar Council membership no., District Bar
// Association, office address, contact. These are critical for the court to
// validate the advocate of record.
function signatureBlock({
  plaintiffLabel = "Plaintiff",
  plaintiffNamePlaceholder = "[insert Plaintiff's full name]"
} = {}) {
  return [
    blank(),
    ...signaturePlaceholder({
      role: plaintiffLabel,
      namePlaceholder: plaintiffNamePlaceholder
    }),
    blank(120),

    para([run("Through Counsel:", { bold: true })], { alignment: AlignmentType.LEFT }),
    blank(40),
    para([run("Signature: ", { bold: true }), run("____________________________________")]),
    blank(40),
    para([run("Name:  ", { bold: true }), run("[insert Advocate's full name]")]),
    para([run("Designation:  ", { bold: true }), run("Advocate [insert: of the High Court / of the Subordinate Courts]")]),
    para([run("Bar Council Membership No.:  ", { bold: true }), run("[insert Bar Council Membership Number]")]),
    para([run("District Bar Association:  ", { bold: true }), run("[insert District Bar Association name, e.g., District Bar Association, Gujranwala]")]),
    para([run("Office Address:  ", { bold: true }), run("[insert Advocate's office address]")]),
    para([run("Contact:  ", { bold: true }), run("[insert mobile number and email]")]),
    para([run("Date:  ", { bold: true }), run("____________________")])
  ];
}

// Verification block — CPC Order VI Rule 15. City and date are document-level
// fields the lawyer fills in at the moment of swearing, hence bracket
// instructions rather than form-bound placeholders.
function verificationBlock({
  knowledgeRange,
  beliefRange,
  signerLabel = "Plaintiff",
  signerNamePlaceholder = "[insert Plaintiff's full name]"
}) {
  return [
    centeredHeading("VERIFICATION", { size: HEADING_SIZE }),
    blank(),
    para([
      run("Verified on oath and solemn affirmation at "),
      run("[insert city of verification]", { bold: true }),
      run(" on this "),
      run("[insert date, e.g., 5", { bold: true }),
      run("th", { bold: true, size: 18 }),
      run(" day of June, 2026]", { bold: true }),
      run(" that the contents of paragraphs "),
      run(knowledgeRange, { bold: true }),
      run(" of the plaint are correct and true to the best of my knowledge, and the contents of paragraphs "),
      run(beliefRange, { bold: true }),
      run(" are true to the best of my information and belief, which I believe to be true.")
    ]),
    ...signaturePlaceholder({
      role: signerLabel,
      namePlaceholder: signerNamePlaceholder
    })
  ];
}

// Page header shown at the top of every page after the first (verification,
// witness list, etc.) so each page reads as a self-contained court document.
function pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subj }) {
  return [
    centeredHeading(courtLine, { size: HEADING_SIZE }),
    centeredText(suitNumberLine, { size: SUBHEADING_SIZE }),
    blank(100),
    centeredText(partyLine, {}),
    blank(100),
    centeredHeading(subj, { underline: true, size: HEADING_SIZE }),
    blank()
  ];
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width,
    children: [
      para(run(text, { bold: opts.bold ?? false }), {
        alignment: opts.alignment ?? AlignmentType.LEFT
      })
    ]
  });
}

function listOfDocumentsProducedPage({ courtLine, suitNumberLine, partyLine, subjectLine: subj, items, signatureBlock: sig }) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("#", { bold: true, alignment: AlignmentType.CENTER, width: { size: 10, type: WidthType.PERCENTAGE } }),
        cell("Document", { bold: true, width: { size: 90, type: WidthType.PERCENTAGE } })
      ]
    }),
    ...items.map((item, idx) =>
      new TableRow({
        children: [
          cell(String(idx + 1), { alignment: AlignmentType.CENTER }),
          cell(item)
        ]
      })
    )
  ];

  return [
    sectionHeading("Schedule of Documents Produced"),
    ...pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subj }),
    centeredHeading("LIST OF DOCUMENTS PRODUCED", { underline: true }),
    blank(),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
    blank(),
    ...sig
  ];
}

function listOfDocumentsReliedUponPage({ courtLine, suitNumberLine, partyLine, subjectLine: subj, replies, signatureBlock: sig }) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("#", { bold: true, alignment: AlignmentType.CENTER, width: { size: 5, type: WidthType.PERCENTAGE } }),
      cell("Question", { bold: true, width: { size: 45, type: WidthType.PERCENTAGE } }),
      cell("Reply", { bold: true, width: { size: 50, type: WidthType.PERCENTAGE } })
    ]
  });
  const dataRows = replies.map((r, idx) =>
    new TableRow({
      children: [
        cell(String(idx + 1), { alignment: AlignmentType.CENTER }),
        cell(r.question),
        cell(r.reply)
      ]
    })
  );

  return [
    sectionHeading("Schedule of Documents Relied Upon"),
    ...pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subj }),
    centeredHeading("LIST OF DOCUMENTS RELIED UPON", { underline: true }),
    blank(),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }),
    blank(),
    ...sig
  ];
}

function listOfWitnessesPage({ courtLine, suitNumberLine, partyLine, subjectLine: subj, witnesses, signatureBlock: sig }) {
  return [
    sectionHeading("Schedule of Witnesses"),
    ...pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subj }),
    centeredHeading("LIST OF WITNESSES", { underline: true }),
    blank(),
    ...witnesses.map((w, idx) => numberedPara(idx + 1, w)),
    blank(),
    para(
      run(
        "All the witnesses will depose in support of the contentions and version put forward in the plaint, and rebut the version of the Defendant, if need be."
      )
    ),
    blank(),
    ...sig
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// Vakalatnama page — Power of Attorney by which the client authorises the
// advocate to appear, plead, and act on the client's behalf. Under Pakistani
// court practice, no plaint is accepted by the court registry without an
// accompanying Vakalatnama signed by the client. Format follows the District
// Bar Association standard plus the model in Aamer Raza Khan, Drafting,
// Pleadings & Conveyancing. Typically filed on stamp paper of the prescribed
// value, but the textual content remains identical.
// ──────────────────────────────────────────────────────────────────────────
function vakalatnamaPage({ courtLine, suitNumberLine, subjectLineText }) {
  return [
    sectionHeading("Vakalatnama"),
    centeredHeading(courtLine, { size: HEADING_SIZE }),
    centeredText(suitNumberLine, { size: SUBHEADING_SIZE }),
    blank(100),
    centeredText("[Plaintiff's full name]    Versus    [Defendant's full name]", {}),
    blank(100),
    centeredHeading(subjectLineText, { underline: true, size: HEADING_SIZE }),
    blank(),
    centeredHeading("VAKALATNAMA", { underline: true, size: HEADING_SIZE }),
    blank(),

    para([
      run("I/We, "),
      run("[insert Client/Plaintiff's full name as per CNIC]", { bold: true }),
      run(" son/daughter/wife of "),
      run("[insert father's/husband's name as per CNIC]", { bold: true }),
      run(", CNIC No. "),
      run("[insert CNIC number in format 12345-1234567-1]", { bold: true }),
      run(", resident of "),
      run("[insert complete residential address including house no., street, area, tehsil, and district]", { bold: true }),
      run(", the above-named Plaintiff in the above-titled case, do hereby nominate, constitute, and appoint "),
      run("[insert Advocate's full name]", { bold: true }),
      run(", Advocate "),
      run("[insert: of the High Court / of the Subordinate Courts]", { bold: true }),
      run(", Bar Council Membership No. "),
      run("[insert Bar Council Membership Number]", { bold: true }),
      run(", having office at "),
      run("[insert Advocate's office address]", { bold: true }),
      run(", as my Counsel/Pleader to appear, act, plead, file, and conduct the above-noted case on my behalf before this Honourable Court and any other court to which the case may be transferred, removed, or referred, with the following powers and authorities:")
    ]),
    blank(),

    numberedPara(1, "To file, prosecute, or defend the above case in this Honourable Court and in any superior court if necessary;"),
    numberedPara(2, "To appear and represent me on all dates of hearing fixed by the Court;"),
    numberedPara(3, "To file plaint, written statement, applications, replies, rejoinders, affidavits, and all other documents and pleadings as may be required;"),
    numberedPara(4, "To examine, cross-examine, and re-examine witnesses;"),
    numberedPara(5, "To address arguments before the Court on facts and law;"),
    numberedPara(6, "To compromise, withdraw, settle, or refer to arbitration the said case or any part thereof, subject to my written consent;"),
    numberedPara(7, "To engage, brief, and consult other Counsel or Senior Counsel as may be considered necessary;"),
    numberedPara(8, "To receive payment of any decreed amount or other money payable in the case and to issue valid receipts therefor;"),
    numberedPara(9, "To file appeals, revisions, review petitions, or applications for execution of decrees in any superior court;"),
    numberedPara(10, "To do all acts, deeds, and things which are necessary or incidental to the proper conduct of the said case."),
    blank(),

    para(run("I further declare that I shall not hold the Counsel responsible for any decision or order passed by the Court in my absence, or due to my default or failure to provide instructions in time. Counsel's professional fees and out-of-pocket expenses shall be paid as separately agreed in writing.")),
    blank(),

    para([
      run("Witnessed and executed at "),
      run("[insert city of execution]", { bold: true }),
      run(" on this "),
      run("[insert day]", { bold: true }),
      run(" day of "),
      run("[insert month]", { bold: true }),
      run(", "),
      run("[insert year]", { bold: true }),
      run(".")
    ]),
    blank(),

    para([run("EXECUTANT (CLIENT)", { bold: true, underline: true })], { alignment: AlignmentType.LEFT }),
    blank(40),
    para([run("Signature:  ", { bold: true }), run("____________________________________")]),
    blank(40),
    para([run("Name:  ", { bold: true }), run("[insert Client/Plaintiff's full name]")]),
    para([run("CNIC:  ", { bold: true }), run("[insert CNIC number]")]),
    para([run("Address:  ", { bold: true }), run("[insert complete residential address]")]),
    para([run("Date:  ", { bold: true }), run("____________________")]),
    blank(120),

    para([run("ACCEPTED BY COUNSEL", { bold: true, underline: true })], { alignment: AlignmentType.LEFT }),
    blank(40),
    para([run("Signature:  ", { bold: true }), run("____________________________________")]),
    blank(40),
    para([run("Name:  ", { bold: true }), run("[insert Advocate's full name]")]),
    para([run("Designation:  ", { bold: true }), run("Advocate [insert: of the High Court / of the Subordinate Courts]")]),
    para([run("Bar Council Membership No.:  ", { bold: true }), run("[insert Bar Council Membership Number]")]),
    para([run("District Bar Association:  ", { bold: true }), run("[insert District Bar Association name]")]),
    para([run("Office Address:  ", { bold: true }), run("[insert Advocate's office address]")]),
    para([run("Mobile:  ", { bold: true }), run("[insert mobile number]")]),
    para([run("Email:  ", { bold: true }), run("[insert email address]")]),
    para([run("Date:  ", { bold: true }), run("____________________")])
  ];
}

function buildDocument(sectionChildren) {
  return new Document({
    creator: "LawFlow",
    description: "Pakistani court plaint template — Module 3.",
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE } }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: PAGE_MARGIN_TWIPS,
              bottom: PAGE_MARGIN_TWIPS,
              left: PAGE_MARGIN_TWIPS,
              right: PAGE_MARGIN_TWIPS
            }
          }
        },
        children: sectionChildren
      }
    ]
  });
}

// ══════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — family/family_khula.docx
//
//   Subject : Suit for Dissolution of Marriage on the basis of Khula
//   Statute : Dissolution of Muslim Marriages Act 1939 read with Khurshid
//             Bibi v Muhammad Amin PLD 1967 SC 97; MFLO 1961 §5;
//             Family Courts Act 1964 §§5, 7; CPC 1908 Order VII Rule 1.
//   Drafting: Tanzil-ur-Rahman, Code of Muslim Personal Law, Vol I, Form K-1.
// ══════════════════════════════════════════════════════════════════════════
function buildKhulaDocument() {
  const courtLine = "IN THE COURT OF SENIOR CIVIL JUDGE / FAMILY JUDGE, [insert court city, e.g., Lahore]";
  const suitNumberLine = "Family Suit No: ________  /  [insert year, e.g., 2026]";
  const subjectLineText = "SUIT FOR DISSOLUTION OF MARRIAGE ON BASIS OF KHULA";
  const partyLine = "[Plaintiff's full name]    Versus    [Defendant's full name]";

  const sig = signatureBlock({
    plaintiffLabel: "Plaintiff / Special Attorney",
    plaintiffNamePlaceholder: "[insert Plaintiff's or Special Attorney's full name]"
  });

  return buildDocument([
    sectionHeading("Cause Title & Parties"),
    ...causeTitle({ courtLine, suitNumberLine }),
    ...partiesBlock({
      plaintiffLines: [
        "[insert Plaintiff's full name as per CNIC] [daughter/son] of [insert father's name as per CNIC], CNIC No. [insert CNIC in format 12345-1234567-1], resident of [insert complete residential address: house no., street, area, tehsil, district], through her real [insert relation, e.g., brother/uncle] / Special Attorney [insert Special Attorney's full name] son of [insert Attorney's father's name], CNIC No. [insert Attorney's CNIC], resident of [insert Attorney's complete address]"
      ],
      defendantLines: [
        "[insert Defendant's full name as per CNIC] son of [insert Defendant's father's name as per CNIC], CNIC No. [insert Defendant's CNIC], resident of [insert Defendant's complete residential address]"
      ]
    }),
    subjectLine(subjectLineText),

    sectionHeading("Body of the Plaint"),
    para(run("The Plaintiff respectfully submits as follows:")),
    blank(),

    numberedPara(1, "That the Plaintiff is [in this paragraph, write a brief profile of the Plaintiff — e.g., a well-educated woman, a doctor by profession; or simply state her age, education, and standing in the community]."),
    numberedPara(2, [
      run("That the Plaintiff's marriage with the Defendant took place according to Muslim rites and Shariah on "),
      run("[insert date of marriage in DD-MM-YYYY format]", { bold: true }),
      run(". The marriage was duly registered in accordance with Section 5 of the Muslim Family Laws Ordinance, 1961 at [insert ward number], [insert union council], [insert city where Nikah was registered]. A copy of the Nikahnama is attached hereto as "),
      run("Annexure \"A\"", { bold: true }),
      run(".")
    ]),
    numberedPara(3, "That Haq Mehar (Dower) was fixed in the amount of Rs. [insert total Haq Mehar amount in figures] /- (Rupees [insert amount in words]), out of which Rs. [insert amount paid at marriage] /- was paid at the time of marriage. The remaining Haq Mehar in the amount of Rs. [insert remaining amount] /- was to be paid \"on demand\" [state present status — e.g., which has never been paid by the Defendant despite repeated demands]."),
    numberedPara(4, "That at the time of marriage, the Plaintiff's family gave dowry articles to the Plaintiff which are currently lying at the Defendant's house. The Plaintiff reserves the right to bring a separate legal action for recovery of the said dowry articles, if need be."),
    numberedPara(5, "That [in this paragraph, describe in 2–3 sentences how the marital relationship broke down. State specific facts such as: non-consummation of the marriage, the Defendant's refusal to cohabit, the Defendant's lack of commitment to the marriage, or any other root cause]."),
    numberedPara(6, "That it was a great shock to the Plaintiff and her family. The Plaintiff and her family have, in good faith, tried to reconcile the matter through family elders and well-wishers, but the Defendant has remained adamant — neither willing to continue the relationship nor ready to grant divorce to the Plaintiff."),
    numberedPara(7, "That the Plaintiff, as an obedient wife, has performed all her conjugal duties and tried her best to save the relationship; however, the Defendant's attitude towards the Plaintiff has been [describe Defendant's conduct in 1–2 words, e.g., rude / cruel / abusive / indifferent / hostile] from the very beginning of the marriage, and has worsened with the passage of time."),
    numberedPara(8, "That the Plaintiff's family has repeatedly requested the Defendant either to reconcile with or to grant divorce to the Plaintiff, but the Defendant has flatly refused to do either, leaving the Plaintiff in a continuing state of mental agony."),
    numberedPara(9, "That [in this paragraph, describe any specific incident(s) of cruelty, abuse, or neglect — for example: \"On [date], the Defendant ousted the Plaintiff from the matrimonial home in the middle of the night without money or belongings, and the Plaintiff was rescued by her family\". If no such incident has occurred, delete this paragraph and renumber subsequent paragraphs accordingly]."),
    numberedPara(10, "That due to the said conduct of the Defendant, severe hatred has developed in the mind of the Plaintiff against the Defendant, and it has now become impossible for the Plaintiff to live with the Defendant as husband and wife within the limits prescribed by Allah Almighty."),
    numberedPara(11, "That the Plaintiff is ready and willing to forgo the Haq Mehar in lieu of a decree for Khula, or to return any amount of Haq Mehar already paid to her, as this Honourable Court may direct in accordance with Islamic jurisprudence and the law."),
    numberedPara(12, [
      run("That the cause of action accrued to the Plaintiff: "),
      run("firstly", { bold: true }),
      run(", on [insert date of marriage] when the Plaintiff got married with the Defendant; "),
      run("secondly", { bold: true }),
      run(", when the Defendant refused to grant divorce to the Plaintiff. The cause of action is continuing and subsists to the present day.")
    ]),
    numberedPara(13, "That the Defendant is residing within the territorial jurisdiction of this Honourable Court at [insert Defendant's address], the marriage was solemnized and registered within the jurisdiction of this Court, and the Plaintiff last resided with the Defendant within the jurisdiction of this Court. The cause of action has also accrued within the jurisdiction of this Court. Therefore, this Honourable Court has jurisdiction to adjudicate upon the matter under Section 5 read with the Schedule of the Family Courts Act, 1964."),
    numberedPara(14, "That the requisite court fee has been affixed with this plaint in accordance with the Court Fees Act, 1870."),

    sectionHeading("Prayer & Signature"),
    centeredHeading("PRAYER"),
    blank(),
    para(run("In view of the foregoing facts and circumstances, it is humbly prayed that this Honourable Court may be pleased to pass a decree for dissolution of marriage on the basis of Khula in favour of the Plaintiff, thereby dissolving the Plaintiff's marriage with the Defendant; together with any other or further relief which this Honourable Court may deem just and proper in the circumstances of the case.")),
    ...sig,

    pageBreak(),
    sectionHeading("Verification"),
    ...pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText }),
    ...verificationBlock({
      knowledgeRange: "1 to 11",
      beliefRange: "12 to 14",
      signerLabel: "Plaintiff / Special Attorney",
      signerNamePlaceholder: "[insert Plaintiff's or Special Attorney's full name]"
    }),

    pageBreak(),
    ...listOfWitnessesPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      witnesses: [
        "Plaintiff herself through her Special Attorney.",
        "[insert second witness's full name] ([insert relation to Plaintiff, e.g., father / brother / uncle]) — concerning the Defendant's conduct and refusal to reconcile.",
        "Any other witness (if required) with permission of the Honourable Court."
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...listOfDocumentsProducedPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      items: [
        "Copy of Nikahnama along with Computerized Marriage Certificate (Annexure \"A\")",
        "Copy of Special Power of Attorney executed by the Plaintiff in favour of the Special Attorney (Annexure \"B\")",
        "Copy of CNIC of Plaintiff (Annexure \"C\")",
        "Copy of CNIC of Plaintiff's Special Attorney (Annexure \"D\")",
        "[Insert any additional annexures supporting the case — e.g., medical reports, photographs, written correspondence, etc.]"
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...listOfDocumentsReliedUponPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      replies: [
        {
          question: "Have you attached any documents with the plaint? If so, which documents?",
          reply: "Yes. As per the List of Documents Produced annexed herewith."
        },
        {
          question: "Will you submit any other documents which are in your possession? If so, what documents?",
          reply: "Yes. As per the List of Documents Produced; and (i) Original Special Power of Attorney; (ii) Original CNIC of the Special Attorney; (iii) any other document as may be required during the proceedings."
        },
        {
          question: "Do you rely upon any documents? If so, what documents?",
          reply: "Yes, the Plaintiff relies upon the documents listed above, and reserves the right to rely upon such further documents as may be found necessary after framing of issues."
        }
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...vakalatnamaPage({ courtLine, suitNumberLine, subjectLineText })
  ]);
}

// ══════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — family/family_maintenance.docx
//
//   Subject : Suit for Recovery of Maintenance (wife / children)
//   Statute : MFLO 1961 §9; Family Courts Act 1964 §§5, 7 + Schedule entry
//             on Maintenance; CPC 1908 Order VII Rule 1.
//   Drafting: Tanzil-ur-Rahman, Vol II, Form M-1 (Maintenance).
//   Note    : Standalone maintenance template — dowry recovery is now a
//             separate file (family_dowry_recovery.docx). The advocate's
//             reference draft combined them in one plaint; we have split
//             them per LawFlow's case_types catalog.
// ══════════════════════════════════════════════════════════════════════════
function buildMaintenanceDocument() {
  const courtLine = "IN THE COURT OF [insert Family Judge designation, e.g., Family Judge / Senior Civil Judge], [insert court city]";
  const suitNumberLine = "Family Suit No: ________  /  [insert year, e.g., 2026]";
  const subjectLineText = "SUIT FOR RECOVERY OF MAINTENANCE";
  const partyLine = "Mst. [Plaintiff's full name]    Versus    [Defendant's full name]";

  const sig = signatureBlock({
    plaintiffLabel: "Plaintiff",
    plaintiffNamePlaceholder: "Mst. [insert Plaintiff's full name]"
  });

  return buildDocument([
    sectionHeading("Cause Title & Parties"),
    ...causeTitle({ courtLine, suitNumberLine }),
    ...partiesBlock({
      plaintiffLines: [
        "Mst. [insert Plaintiff's full name as per CNIC] [daughter/wife] of [insert father's/husband's name as per CNIC], CNIC No. [insert CNIC in format 12345-1234567-1], resident of [insert complete residential address: house no., street, area, tehsil, district]"
      ],
      defendantLines: [
        "[insert Defendant's full name as per CNIC] son of [insert Defendant's father's name], CNIC No. [insert Defendant's CNIC], resident of [insert Defendant's complete residential address]"
      ]
    }),
    subjectLine(subjectLineText),

    sectionHeading("Body of the Plaint"),
    para(run("The Plaintiff above-named respectfully submits as follows:")),
    blank(),

    numberedPara(1, [
      run("That the Plaintiff was married with the Defendant on "),
      run("[insert date of marriage in DD-MM-YYYY format]", { bold: true }),
      run(" at [insert place of marriage] in accordance with Islamic Shariah, and the marriage was duly registered under Section 5 of the Muslim Family Laws Ordinance, 1961. A photocopy of the Nikahnama is enclosed herewith as "),
      run("Annexure \"A\"", { bold: true }),
      run(".")
    ]),
    numberedPara(2, "That after the solemnization of marriage, the Plaintiff continued to live with the Defendant as a faithful wife and performed all her matrimonial duties and obligations."),
    numberedPara(3, "That [in this paragraph, describe how the marital relationship deteriorated and the Plaintiff was deprived of maintenance. For example: \"the Defendant kept the Plaintiff properly only for [insert years of cohabitation] years; thereafter his behaviour became harsh and abusive; eventually the Plaintiff was forced to leave the matrimonial home on [insert separation date]\"]."),
    numberedPara(4, "That [in this paragraph, state the specific facts about the Defendant's conduct giving rise to the maintenance claim — for example: contracting a second marriage without the Plaintiff's permission in defiance of Section 6 of the Muslim Family Laws Ordinance 1961; ouster from the matrimonial home; or persistent refusal to provide maintenance despite repeated demands]."),
    numberedPara(5, "That since [insert date of separation], the Plaintiff has been living at [insert Plaintiff's current residential address]. The Plaintiff has, through family elders and community arbitration, made repeated attempts at reconciliation; however, the Defendant has refused either to keep the Plaintiff as his wife or to provide her with any maintenance."),
    numberedPara(6, "That the Plaintiff is, and has always been, willing to live with the Defendant within the limits prescribed by Allah Almighty and to perform her conjugal rights and obligations, subject to her receiving the maintenance to which she is entitled in law and in religion."),
    numberedPara(7, "That the Defendant is [insert Defendant's occupation, e.g., a businessman / government employee / agriculturist] and his approximate monthly income is Rs. [insert estimated monthly income in figures] /- (Rupees [insert amount in words]). He is fully capable of providing maintenance to the Plaintiff in accordance with his means."),
    numberedPara(8, "That during the past [insert period since separation, e.g., 6 months / 1 year / 2 years], the Defendant has not paid a single penny to the Plaintiff as maintenance, despite his clear legal and religious obligation under Section 9 of the Muslim Family Laws Ordinance, 1961 and Islamic Personal Law."),
    numberedPara(9, "That the Plaintiff has no independent source of income and has been entirely dependent on her parents and relatives, which is causing her continuous mental agony and financial hardship."),
    numberedPara(10, [
      run("That the Plaintiff is entitled, under Muslim Personal Law and Section 9 of the Muslim Family Laws Ordinance, 1961, to maintenance from the Defendant. The Plaintiff therefore claims:"),
      run("", { break: 1 }),
      run("    (i)  ", {}),
      run("Past maintenance: ", { bold: true }),
      run("A consolidated amount of Rs. [insert total past maintenance amount] /- (Rupees [insert amount in words]) being maintenance at the rate of Rs. [insert monthly amount] /- per month for the past [insert number of months] months from [insert arrears-start date] to date."),
      run("", { break: 1 }),
      run("    (ii) ", {}),
      run("Future maintenance: ", { bold: true }),
      run("A monthly maintenance allowance of Rs. [insert monthly amount] /- per month, payable from the date of filing of this suit onwards.")
    ]),
    numberedPara(11, [
      run("That the Plaintiff caused a legal notice dated "),
      run("[insert date of legal notice]", { bold: true }),
      run(" to be served upon the Defendant by registered post and courier service (copies of the legal notice and the postal/courier delivery receipts are attached as "),
      run("Annexures \"B\" and \"C\"", { bold: true }),
      run("). The Defendant has neither replied to the notice nor remitted any maintenance.")
    ]),
    numberedPara(12, "That the cause of action arose to the Plaintiff first on [insert date of separation] when the Plaintiff was forced to leave the matrimonial home, and thereafter on each day and each month on which the Defendant has failed to provide maintenance. The cause of action is continuing and subsists until the recovery of the entire arrears of maintenance."),
    numberedPara(13, "That the Plaintiff resides within the territorial limits of this Honourable Court, and the cause of action has arisen within its jurisdiction. This Court therefore has jurisdiction to adjudicate the matter under Section 5 read with the Schedule of the Family Courts Act, 1964."),
    numberedPara(14, "That the requisite court fee has been affixed with this plaint in accordance with the Court Fees Act, 1870."),

    sectionHeading("Prayer & Signature"),
    centeredHeading("PRAYER"),
    blank(),
    para(run("It is therefore most respectfully prayed that this Honourable Court may be pleased to pass a judgment and decree in favour of the Plaintiff and against the Defendant, granting:")),
    blank(80),
    para([run("(i)   ", { bold: true }), run("Past maintenance of Rs. [insert amount] /- (Rupees [insert amount in words]) for the period from [insert arrears-start date] to date;")]),
    para([run("(ii)  ", { bold: true }), run("Future maintenance at the rate of Rs. [insert monthly amount] /- per month from the date of filing of this suit;")]),
    para([run("(iii) ", { bold: true }), run("Costs of the suit;")]),
    para([run("(iv)  ", { bold: true }), run("Any other relief or reliefs which this Honourable Court may deem just and proper in the circumstances of the case.")]),
    blank(),
    para(run("[insert filing city].")),
    para(run("Dated: [insert filing date].")),
    ...sig,

    pageBreak(),
    sectionHeading("Verification"),
    ...pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText }),
    ...verificationBlock({
      knowledgeRange: "1 to 11",
      beliefRange: "12 to 14",
      signerLabel: "Plaintiff",
      signerNamePlaceholder: "Mst. [insert Plaintiff's full name]"
    }),

    pageBreak(),
    ...listOfWitnessesPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      witnesses: [
        "Plaintiff herself.",
        "[insert second witness's full name] — [insert relation to Plaintiff, e.g., father / brother] of the Plaintiff (deposing concerning the Defendant's refusal to pay maintenance).",
        "Any other witness (if required) with permission of the Honourable Court."
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...listOfDocumentsProducedPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      items: [
        "Copy of Nikahnama / Marriage Certificate (Annexure \"A\")",
        "Copy of Legal Notice dated [insert date of legal notice] (Annexure \"B\")",
        "Postal / Courier Receipts and Delivery Confirmation Report (Annexure \"C\")",
        "Copy of CNIC of Plaintiff (Annexure \"D\")",
        "[Income proof of Defendant, if available, e.g., salary slip, business registration — Annexure \"E\"]"
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...listOfDocumentsReliedUponPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      replies: [
        {
          question: "Have you attached any documents with the plaint? If so, which documents?",
          reply: "Yes. As per the List of Documents Produced annexed herewith."
        },
        {
          question: "Will you submit any other documents which are in your possession? If so, what documents?",
          reply: "Yes. Originals of all annexures, along with any other document as may be required during the proceedings."
        },
        {
          question: "Do you rely upon any documents? If so, what documents?",
          reply: "Yes, the Plaintiff relies upon the documents mentioned above, and reserves the right to rely upon such further documents as may be found necessary after framing of issues."
        }
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...vakalatnamaPage({ courtLine, suitNumberLine, subjectLineText })
  ]);
}

// ══════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — family/family_dowry_recovery.docx
//
//   Subject : Suit for Recovery of Dowry Articles
//   Statute : Dowry and Bridal Gifts (Restriction) Act 1976 (Act XLIII of
//             1976); Family Courts Act 1964 §5 + Schedule entry on Dowry /
//             Personal Property of Wife; MFLO 1961 §5 (Nikah registration).
//   Drafting: Tanzil-ur-Rahman, Vol II, Form D-1 (Dowry / Stridhan recovery).
//   Note    : Dowry is the wife's exclusive property under Pakistani Muslim
//             personal law (cf. Mulla, Principles of Mahomedan Law §285;
//             Khurshid Bibi v Babu Khan, PLD 1985 SC 38).
// ══════════════════════════════════════════════════════════════════════════
function buildDowryRecoveryDocument() {
  const courtLine = "IN THE COURT OF [insert Family Judge designation], [insert court city]";
  const suitNumberLine = "Family Suit No: ________  /  [insert year, e.g., 2026]";
  const subjectLineText = "SUIT FOR RECOVERY OF DOWRY ARTICLES";
  const partyLine = "Mst. [Plaintiff's full name]    Versus    [Defendant's full name]";

  const sig = signatureBlock({
    plaintiffLabel: "Plaintiff",
    plaintiffNamePlaceholder: "Mst. [insert Plaintiff's full name]"
  });

  return buildDocument([
    sectionHeading("Cause Title & Parties"),
    ...causeTitle({ courtLine, suitNumberLine }),
    ...partiesBlock({
      plaintiffLines: [
        "Mst. [insert Plaintiff's full name as per CNIC] [daughter/wife] of [insert father's/husband's name as per CNIC], CNIC No. [insert CNIC in format 12345-1234567-1], resident of [insert complete residential address: house no., street, area, tehsil, district]"
      ],
      defendantLines: [
        "[insert Defendant's full name as per CNIC] son of [insert Defendant's father's name], CNIC No. [insert Defendant's CNIC], resident of [insert Defendant's complete residential address]"
      ]
    }),
    subjectLine(subjectLineText),

    sectionHeading("Body of the Plaint"),
    para(run("The Plaintiff above-named respectfully submits as follows:")),
    blank(),

    numberedPara(1, [
      run("That the Plaintiff was married with the Defendant on "),
      run("[insert date of marriage in DD-MM-YYYY format]", { bold: true }),
      run(" at [insert place of marriage] in accordance with Islamic Shariah, and the marriage was duly registered under Section 5 of the Muslim Family Laws Ordinance, 1961. A photocopy of the Nikahnama is attached hereto as "),
      run("Annexure \"A\"", { bold: true }),
      run(".")
    ]),
    numberedPara(2, "That after the solemnization of the marriage, the Plaintiff lived with the Defendant at the matrimonial home situated at [insert complete address of the matrimonial home], and the entirety of her dowry articles were taken to, and remain at, the said house."),
    numberedPara(3, [
      run("That at the time of the marriage, the Plaintiff's parents — out of their hard-earned savings — gave the Plaintiff dowry articles consisting of [briefly describe the categories of dowry articles, e.g., gold ornaments, clothes, household furniture, kitchenware, electrical appliances, and other valuables]. A complete itemised list of the said dowry articles, along with their respective approximate values, is attached as "),
      run("Annexure \"B\"", { bold: true }),
      run(".")
    ]),
    numberedPara(4, "That the total approximate value of the Plaintiff's dowry articles, as set out in Annexure \"B\", is Rs. [insert total value in figures] /- (Rupees [insert value in words])."),
    numberedPara(5, "That dowry, under Pakistani Muslim Personal Law, is the exclusive property of the wife. Reference is respectfully made to Mulla, Principles of Mahomedan Law, §285, and the consistent judicial recognition of this position by the Honourable Supreme Court of Pakistan and the High Courts (see Khurshid Bibi v Babu Khan, PLD 1985 SC 38)."),
    numberedPara(6, "That on [insert date of separation], [in this paragraph, describe in 2–3 sentences how the Plaintiff left or was forced to leave the matrimonial home, and how the dowry articles came to remain in the Defendant's exclusive possession]."),
    numberedPara(7, "That despite repeated demands by the Plaintiff — both verbally and through family elders and community arbitration — the Defendant has refused to return the said dowry articles to the Plaintiff."),
    numberedPara(8, [
      run("That the Plaintiff caused a legal notice dated "),
      run("[insert date of legal notice]", { bold: true }),
      run(" to be served upon the Defendant calling for the return of the dowry articles within [insert notice period, e.g., 15] days. The notice was duly received by the Defendant (copy of notice and delivery receipts attached as "),
      run("Annexures \"C\" and \"D\"", { bold: true }),
      run("); however, the Defendant has neither replied to the notice nor returned the dowry articles.")
    ]),
    numberedPara(9, "That the wrongful retention of the Plaintiff's dowry by the Defendant amounts to a violation of the Plaintiff's exclusive proprietary rights, and is actionable under the Dowry and Bridal Gifts (Restriction) Act, 1976 read with the Schedule of the Family Courts Act, 1964."),
    numberedPara(10, "That the cause of action accrued to the Plaintiff first on [insert date of separation] when the Defendant came into exclusive possession of the dowry articles, and thereafter on [insert date when Defendant refused to return the articles] when the Defendant refused to comply with the legal notice. The cause of action continues to subsist until the dowry articles are restored to the Plaintiff."),
    numberedPara(11, "That the Plaintiff resides within the territorial limits of this Honourable Court, and the cause of action has arisen within its jurisdiction. This Court has jurisdiction under Section 5 read with the Schedule of the Family Courts Act, 1964."),
    numberedPara(12, "That the requisite court fee has been affixed with this plaint in accordance with the Court Fees Act, 1870 and the Suits Valuation Act, 1887."),

    sectionHeading("Prayer & Signature"),
    centeredHeading("PRAYER"),
    blank(),
    para(run("It is therefore most respectfully prayed that this Honourable Court may be pleased to pass a judgment and decree in favour of the Plaintiff and against the Defendant, granting:")),
    blank(80),
    para([run("(a) ", { bold: true }), run("A direction to the Defendant to return forthwith to the Plaintiff all the dowry articles listed in Annexure \"B\" to this plaint;")]),
    para([run("(b) ", { bold: true }), run("In the alternative, in case the Defendant is unable to return the said articles in specie, a decree for payment of Rs. [insert total value of dowry articles] /- (Rupees [insert value in words]) being the value of the said dowry articles, together with mark-up / damages as this Honourable Court may deem fit;")]),
    para([run("(c) ", { bold: true }), run("Costs of the suit;")]),
    para([run("(d) ", { bold: true }), run("Any other relief or reliefs which this Honourable Court may deem just and proper in the circumstances of the case.")]),
    blank(),
    para(run("[insert filing city].")),
    para(run("Dated: [insert filing date].")),
    ...sig,

    pageBreak(),
    sectionHeading("Verification"),
    ...pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText }),
    ...verificationBlock({
      knowledgeRange: "1 to 9",
      beliefRange: "10 to 12",
      signerLabel: "Plaintiff",
      signerNamePlaceholder: "Mst. [insert Plaintiff's full name]"
    }),

    pageBreak(),
    ...listOfWitnessesPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      witnesses: [
        "Plaintiff herself.",
        "[insert second witness's full name] ([insert relation to Plaintiff, e.g., father / mother / brother]) — deposing concerning the dowry articles given at the time of marriage.",
        "[insert third witness's full name] ([insert relation to Plaintiff]) — deposing concerning the dowry articles remaining at the Defendant's house.",
        "Any other witness (if required) with permission of the Honourable Court."
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...listOfDocumentsProducedPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      items: [
        "Copy of Nikahnama / Marriage Certificate (Annexure \"A\")",
        "Itemised List of Dowry Articles with their respective values, signed by the Plaintiff's parents (Annexure \"B\")",
        "Copy of Legal Notice dated [insert date of legal notice] (Annexure \"C\")",
        "Postal / Courier Receipts and Delivery Confirmation Report (Annexure \"D\")",
        "[Photographs and/or purchase receipts of the dowry articles, if available — Annexure \"E\"]",
        "Copy of CNIC of Plaintiff (Annexure \"F\")"
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...listOfDocumentsReliedUponPage({
      courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText,
      replies: [
        {
          question: "Have you attached any documents with the plaint? If so, which documents?",
          reply: "Yes. As per the List of Documents Produced annexed herewith."
        },
        {
          question: "Will you submit any other documents which are in your possession? If so, what documents?",
          reply: "Yes. Originals of all annexures, including the itemised dowry list signed by the Plaintiff's parents, and any photographs / purchase receipts evidencing the said dowry articles."
        },
        {
          question: "Do you rely upon any documents? If so, what documents?",
          reply: "Yes, the Plaintiff relies upon the documents mentioned above, and reserves the right to rely upon such further documents as may be found necessary after framing of issues."
        }
      ],
      signatureBlock: sig
    }),

    pageBreak(),
    ...vakalatnamaPage({ courtLine, suitNumberLine, subjectLineText })
  ]);
}

// ══════════════════════════════════════════════════════════════════════════
// TEMPLATE 4 — civil/civil_declaration.docx
//
//   Subject : Suit for Declaration and Mandatory Injunction
//   Statute : Specific Relief Act 1877 §42 (declaration), §55 (mandatory
//             injunction); CPC 1908 §9 (jurisdiction), Order VII Rule 1,
//             Order VI Rule 15 (verification); Court Fees Act 1870
//             Schedule II Article 17(iii) for declaratory suits.
//   Drafting: D.F. Mulla, Code of Civil Procedure; Aamer Raza A. Khan,
//             Drafting Pleadings & Conveyancing, Form D-3.
// ══════════════════════════════════════════════════════════════════════════
function buildDeclarationDocument() {
  const courtLine = "IN THE COURT OF LEARNED SENIOR CIVIL JUDGE, [insert court city, e.g., Gujranwala]";
  const suitNumberLine = "Civil Suit No: ________  /  [insert year, e.g., 2026]";
  const subjectLineText = "SUIT FOR DECLARATION AND MANDATORY INJUNCTION";
  const partyLine = "[Plaintiff's full name]    Versus    [Defendant's full name]";

  const sig = signatureBlock({
    plaintiffLabel: "Plaintiff",
    plaintiffNamePlaceholder: "[insert Plaintiff's full name]"
  });

  return buildDocument([
    sectionHeading("Cause Title & Parties"),
    ...causeTitle({ courtLine, suitNumberLine }),
    ...partiesBlock({
      plaintiffLines: [
        "[insert Plaintiff's full name as per CNIC]",
        "Son / Daughter of [insert Plaintiff's father's name as per CNIC]",
        "CNIC No. [insert CNIC in format 12345-1234567-1]",
        "Resident of [insert complete residential address: house no., street, area, tehsil, district]"
      ],
      defendantLines: [
        "[insert Defendant's designation / name of the public authority], [insert full official name of the authority], [insert official address]",
        "Through its [insert representative title, e.g., Chief Officer / Director / Registrar]"
      ]
    }),
    subjectLine(subjectLineText),

    sectionHeading("Body of the Plaint"),
    centeredText("Respectfully Sheweth:"),
    blank(),

    numberedPara(1, "That the Plaintiff is a law-abiding citizen of Pakistan and is competent to file the present suit."),
    numberedPara(2, "That the Defendant is [describe the nature of the public authority, e.g., a public authority / statutory body / local body] responsible for [describe the Defendant's responsibility, e.g., maintaining official records including registration of marriage certificates], and is therefore liable to be sued through its [insert representative title, e.g., Chief Officer]."),
    numberedPara(3, "That [in this paragraph, set out the original event or transaction giving rise to the need for declaration. For example: \"the marriage of the Plaintiff was solemnized with [insert wife's name], CNIC No. [insert CNIC], on [insert date of marriage] according to Muslim rites and customs\"]."),
    numberedPara(4, "That [in this paragraph, set out the document held by the Defendant that contains the error and requires declaration. For example: \"the said marriage was duly registered with the Defendant on [insert registration date]; however, the marriage certificate / Nikahnama contains incorrect entries due to the negligence of the Defendant's officials\"]."),
    numberedPara(5, "That the incorrect entries / disputed matters are as under:"),
    para([
      run("    i.   ", { bold: true }),
      run("[insert label of first incorrect entry, e.g., Plaintiff's Name]: ", { bold: true }),
      run("Recorded as \"[insert recorded (wrong) value]\" instead of the correct value \"[insert correct value]\" as per [insert authoritative record, e.g., CNIC].")
    ], { indent: { left: 720 } }),
    para([
      run("    ii.  ", { bold: true }),
      run("[insert label of second incorrect entry, e.g., Wife's Name]: ", { bold: true }),
      run("Recorded as \"[insert recorded value]\" instead of the correct value \"[insert correct value]\" as per [insert authoritative record].")
    ], { indent: { left: 720 } }),
    para([
      run("    iii. ", { bold: true }),
      run("[insert label of third incorrect entry, e.g., Wife's Age]: ", { bold: true }),
      run("Recorded as \"[insert recorded value]\" whereas the correct value is \"[insert correct value]\". (Delete this sub-paragraph if not applicable, and renumber subsequent items.)")
    ], { indent: { left: 720 } }),
    numberedPara(6, "That the above errors, though clerical in nature, materially affect the legal identity and official record of the Plaintiff (and his / her [insert affected relative, e.g., wife / minor children, if applicable]), and have caused or are likely to cause substantial prejudice."),
    numberedPara(7, "That the Plaintiff approached the Defendant on [insert date of approach to the authority] for correction of the said record through a proper written application; however, the officials of the Defendant have failed and/or refused to rectify the same to date."),
    numberedPara(8, "That the cause of action accrued on [insert date the incorrect entry was made or discovered] when the incorrect entry was made / discovered, and continues to subsist on each day on which the Defendant fails to correct the record."),
    numberedPara(9, "That this Honourable Court has jurisdiction to entertain and adjudicate upon the present suit, as the cause of action has arisen, and the Defendant resides / functions, within the territorial limits of this Court. Section 9 of the Civil Procedure Code, 1908, conferring general jurisdiction on civil courts, is hereby invoked."),
    numberedPara(10, "That the requisite court fee has been affixed in accordance with the Court Fees Act, 1870 (Schedule II Article 17(iii) for declaratory suits) and the Suits Valuation Act, 1887."),

    sectionHeading("Prayer & Signature"),
    centeredHeading("PRAYER"),
    blank(),
    para(run("It is therefore most respectfully prayed that this Honourable Court may graciously be pleased to:")),
    blank(80),
    para([run("(a) ", { bold: true }), run("Declare under Section 42 of the Specific Relief Act, 1877, that [insert the declaratory relief in clear terms — e.g., \"the correct name of the Plaintiff is 'XXXXX' and not 'YYYYY'\"];")]),
    para([run("(b) ", { bold: true }), run("Declare further that [insert second declaratory relief, if any];")]),
    para([run("(c) ", { bold: true }), run("Declare further that [insert third declaratory relief, if applicable; otherwise delete this clause];")]),
    para([run("(d) ", { bold: true }), run("Direct the Defendant by way of Mandatory Injunction under Section 55 of the Specific Relief Act, 1877, to correct / rectify the [insert name of the document to be corrected, e.g., the marriage certificate / Nikahnama / official register entry] in accordance with the declarations prayed for above;")]),
    para([run("(e) ", { bold: true }), run("Grant any other or further relief which this Honourable Court may deem just, equitable, and proper in the circumstances of the case.")]),
    ...sig,

    pageBreak(),
    sectionHeading("Verification"),
    ...pageHeader({ courtLine, suitNumberLine, partyLine, subjectLine: subjectLineText }),
    ...verificationBlock({
      knowledgeRange: "1 to 8",
      beliefRange: "9 to 10",
      signerLabel: "Plaintiff",
      signerNamePlaceholder: "[insert Plaintiff's full name]"
    }),

    pageBreak(),
    ...vakalatnamaPage({ courtLine, suitNumberLine, subjectLineText })
  ]);
}

// ══════════════════════════════════════════════════════════════════════════
// RESEARCH DOCUMENT — Pakistani Legal Drafting Foundations
//
// A separate Word document that lives alongside LEGAL-BASIS.md and the 4
// case templates. Its purpose is academic defence: every statute, case, and
// textbook used to construct the templates is listed here with a clickable
// hyperlink (where free) or a verification path (where print-only).
//
// Generated by this same script so it stays in sync with the templates.
// ══════════════════════════════════════════════════════════════════════════

// Hyperlink helper — produces a clickable URL styled in Word's default
// hyperlink blue + single underline.
function hyperlink(text, url, opts = {}) {
  return new ExternalHyperlink({
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? BODY_SIZE,
        color: "0563C1",
        underline: { type: "single" }
      })
    ],
    link: url
  });
}

function researchHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, before: 400, after: 200 },
    children: [
      new TextRun({ text, font: FONT, size: 32, bold: true, color: "01411C" })
    ]
  });
}

function researchHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, before: 280, after: 140 },
    children: [
      new TextRun({ text, font: FONT, size: 26, bold: true, color: "024A23" })
    ]
  });
}

// Builds a 4-column reference table: # | Title | Citation | Where to access.
function referenceTable(rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("#", { bold: true, alignment: AlignmentType.CENTER, width: { size: 5,  type: WidthType.PERCENTAGE } }),
      cell("Source", { bold: true, width: { size: 40, type: WidthType.PERCENTAGE } }),
      cell("Citation / Provision", { bold: true, width: { size: 25, type: WidthType.PERCENTAGE } }),
      cell("Where to access", { bold: true, width: { size: 30, type: WidthType.PERCENTAGE } })
    ]
  });

  const bodyRows = rows.map((r, idx) => {
    const accessChildren = r.access.url
      ? [
          new Paragraph({
            children: [hyperlink(r.access.label || r.access.url, r.access.url)],
            spacing: { line: LINE_SPACING }
          })
        ]
      : [
          new Paragraph({
            children: [run(r.access.label || "", { italics: true, color: SECTION_GRAY })],
            spacing: { line: LINE_SPACING }
          })
        ];

    return new TableRow({
      children: [
        cell(String(idx + 1), { alignment: AlignmentType.CENTER }),
        cell(r.source),
        cell(r.citation),
        new TableCell({ children: accessChildren })
      ]
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows]
  });
}

function bulletPara(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, after: 100 },
    indent: { left: 360 },
    children: [run(`•  ${text}`)]
  });
}

function buildResearchDocument() {
  return buildDocument([
    // ═══════════════════════════════════════════════════════════════════════
    // COVER PAGE
    // ═══════════════════════════════════════════════════════════════════════
    blank(800),
    centeredText("LawFlow", { bold: true, size: 56, color: "01411C" }),
    centeredText("Smart Case Filing System", { italics: true, size: 26 }),
    blank(600),
    centeredText("Research & Reference Document", { bold: true, size: 40 }),
    blank(100),
    centeredText("Pakistani Legal Drafting Foundations", { size: 32 }),
    centeredText("for the Module 3 Case Templates", { size: 28 }),
    blank(600),
    centeredText("Module 3 — Online Document Editing", { size: 24 }),
    centeredText("and Digital Case File PDF Preparation", { size: 24 }),
    blank(800),
    centeredText("Final Year Project — Faculty of Computer Science", { size: 22 }),
    centeredText("GIFT University, Gujranwala", { size: 22 }),
    centeredText("2026", { size: 22 }),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 1. EXECUTIVE SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("1.  Executive Summary"),
    para(run("This document compiles the primary legal sources, judicial authorities, and academic drafting texts on which the Pakistani court-plaint templates of Module 3 are built. Its purpose is academic defence: every paragraph in every template can be traced to a section of a Pakistani statute, a judgment of the superior courts, or a recognised drafting authority. Each reference below is hyperlinked to a publicly accessible authoritative source, or — where the source is print-only — to a verification path at the GIFT University Law Library or a Bar Council library.")),
    blank(),
    para(run("Currently four of the ten supported case types are implemented:")),
    bulletPara("Civil — Suit for Declaration and Mandatory Injunction"),
    bulletPara("Family — Suit for Dissolution of Marriage on basis of Khula"),
    bulletPara("Family — Suit for Recovery of Maintenance"),
    bulletPara("Family — Suit for Recovery of Dowry Articles"),
    blank(),
    para(run("The remaining six templates (4 civil + 2 family) are pending receipt of advocate-supplied reference drafts, but the legal anchors for each are already mapped in §13 of this document so they can be added without further research.")),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 2. PROJECT CONTEXT
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("2.  Project Context"),

    researchHeading2("2.1  The LawFlow System"),
    para(run("LawFlow is a web-based platform digitalising the pre-hearing case-filing process for civil and family disputes at the tehsil-court level in Pakistan, with initial deployment focus on Tehsil Gujranwala. The platform serves four user roles — Client, Lawyer, Registrar, and Administrator — and is organised into eight functional modules.")),

    researchHeading2("2.2  Module 3 Scope (FE-1 – FE-8)"),
    para(run("Module 3 satisfies eight functional requirements:")),
    bulletPara("FE-1: Centralised library of editable templates for 5 civil + 5 family case types."),
    bulletPara("FE-2: Separate drafting templates for plaints/petitions per case category."),
    bulletPara("FE-3: Integrated online document editor."),
    bulletPara("FE-4: Edit case-specific and client-specific details inside the editor."),
    bulletPara("FE-5: Save drafts, update later, mark as finalised."),
    bulletPara("FE-6: Add supporting documents and evidence attachments."),
    bulletPara("FE-7: Arrange the sequence of documents in the case file."),
    bulletPara("FE-8: Compile finalised documents and attachments into one PDF for registrar submission."),

    researchHeading2("2.3  Ten Supported Case Types"),
    para(run("The case-type catalogue is fixed at the tehsil level by the jurisdictional schedule of the Civil and Family Courts in Punjab. The ten supported types are:")),
    blank(80),
    para(run("Civil (Senior Civil Judge / Civil Court):"), { alignment: AlignmentType.LEFT }),
    bulletPara("1. Suit for Recovery of Money — CPC 1908; Contract Act 1872."),
    bulletPara("2. Suit for Permanent Injunction — Specific Relief Act 1877."),
    bulletPara("3. Suit for Declaration — Specific Relief Act 1877."),
    bulletPara("4. Suit for Specific Performance of Agreement — Specific Relief Act 1877."),
    bulletPara("5. Suit for Possession of Property — CPC 1908."),
    blank(80),
    para(run("Family (Family Judge):"), { alignment: AlignmentType.LEFT }),
    bulletPara("1. Khula (Wife's Judicial Divorce) — Dissolution of Muslim Marriages Act 1939 + MFLO 1961."),
    bulletPara("2. Maintenance (Wife & Children) — MFLO 1961 + Family Courts Act 1964."),
    bulletPara("3. Recovery of Dowry Articles — Dowry & Bridal Gifts (Restriction) Act 1976 + Family Courts Act 1964."),
    bulletPara("4. Custody of Minors (Hizanat) — Guardians and Wards Act 1890 + Family Courts Act 1964."),
    bulletPara("5. Restitution of Conjugal Rights — Family Courts Act 1964."),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 3. METHODOLOGY
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("3.  Methodology"),

    para(run("The templates were not authored in isolation. They were derived from a triangulation of three independent sources, each verifying the other two:")),

    researchHeading2("3.1  Advocate-Supplied Reference Drafts (Primary Practical Reference)"),
    para(run("A consulting advocate provided three actual court plaints filed in Pakistani family and civil courts. These provided the immediate practical reference for paragraph structure, language conventions (\"That…\" sentence opener; \"Sheweth:\" / \"Respectfully Submits:\" opening line; numbered factual paragraphs; jurisdiction clause; court-fee paragraph; PRAYER block), and the supporting-document schedules required at filing.")),

    researchHeading2("3.2  Pakistani Statutory Framework (Primary Legal Reference)"),
    para(run("The structural anchor for every paragraph in every plaint is a section of a Pakistani statute. The universal scaffolding comes from the Civil Procedure Code 1908, specifically Order VII Rule 1 (particulars to be contained in a plaint) and Order VI Rule 15 (verification of pleadings). Family suits additionally satisfy Section 7(2) of the Family Courts Act 1964, which mandates the Schedule of Witnesses and Documents.")),

    researchHeading2("3.3  Established Drafting Authorities (Academic Reference)"),
    para(run("The paragraph forms in each template follow recognised Pakistani drafting authorities, principally D.F. Mulla's Code of Civil Procedure for civil suits and Justice Tanzil-ur-Rahman's Code of Muslim Personal Law for family suits. These works are universally consulted in Pakistani legal academia and practice.")),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 4. PRIMARY LEGAL SOURCES (STATUTES)
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("4.  Primary Legal Sources — Pakistani Statutes"),

    para(run("All Pakistani federal statutes are published in full on the official Government of Pakistan legal portal:")),
    blank(80),
    para([
      run("🌐  Official portal:  "),
      hyperlink("https://pakistancode.gov.pk/", "https://pakistancode.gov.pk/")
    ]),
    blank(),
    para(run("The statutes cited across our four templates, with direct hyperlinks:")),
    blank(),

    referenceTable([
      {
        source: "Code of Civil Procedure (Act V of 1908) — Order VI Rule 15 (verification); Order VII Rule 1 (particulars in plaint); Section 9 (jurisdiction of civil courts).",
        citation: "CPC 1908",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Nlpsf-sg-jjjjjjjjjjjjj.html" }
      },
      {
        source: "Specific Relief Act (Act I of 1877) — Sections 42 (declaratory decree) and 55 (mandatory injunction).",
        citation: "SRA 1877",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      },
      {
        source: "Court Fees Act (Act VII of 1870) — Schedule II Article 17(iii) for declaratory suits.",
        citation: "CFA 1870",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      },
      {
        source: "Suits Valuation Act (Act VII of 1887) — Section 4 (jurisdictional valuation).",
        citation: "SVA 1887",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      },
      {
        source: "Dissolution of Muslim Marriages Act (Act VIII of 1939) — Section 2 (grounds for dissolution; Khula is read into this framework through case law).",
        citation: "DMMA 1939",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      },
      {
        source: "Muslim Family Laws Ordinance (Ord. VIII of 1961) — Section 5 (Nikah registration); Section 6 (permission for second marriage); Section 9 (maintenance).",
        citation: "MFLO 1961",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      },
      {
        source: "Family Courts Act (Act XXXV of 1964) — Section 5 + Schedule (jurisdiction over family matters); Section 7(2) (form of plaint with witness + document schedules); Section 17 (CPC applicability).",
        citation: "FCA 1964",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      },
      {
        source: "Guardians and Wards Act (Act VIII of 1890) — applicable to custody of minors petitions.",
        citation: "GWA 1890",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      },
      {
        source: "Dowry and Bridal Gifts (Restriction) Act (Act XLIII of 1976) — wife's exclusive proprietary interest in dowry articles.",
        citation: "DBGA 1976",
        access: { label: "pakistancode.gov.pk", url: "https://pakistancode.gov.pk/" }
      }
    ]),
    blank(),
    para(run("Provincial supplementary rules (e.g., Punjab Family Court Rules) are available at:"), { alignment: AlignmentType.LEFT }),
    para([
      run("•  "),
      hyperlink("https://punjabcode.punjab.gov.pk/", "https://punjabcode.punjab.gov.pk/"),
      run(" — Punjab Code (provincial laws of Punjab).")
    ]),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 5. CASE LAW AUTHORITIES
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("5.  Case Law Authorities"),

    para(run("The following Pakistani Supreme Court and High Court judgments are cited in the templates or in this research document. Pakistani case citations follow the format \"Case Name, YEAR Report Volume Page\".")),
    blank(80),
    para([
      run("🌐  Free judgment search:  "),
      hyperlink("https://www.supremecourt.gov.pk/case-laws/", "https://www.supremecourt.gov.pk/case-laws/")
    ]),
    blank(80),
    para([
      run("🌐  Federal Shariat Court:  "),
      hyperlink("https://www.federalshariatcourt.gov.pk/", "https://www.federalshariatcourt.gov.pk/")
    ]),
    blank(),

    referenceTable([
      {
        source: "Khurshid Bibi v Muhammad Amin — landmark Supreme Court judgment establishing Khula as a wife's judicial right when continuation of marriage within \"limits of Allah\" has become impossible.",
        citation: "PLD 1967 SC 97",
        access: { label: "supremecourt.gov.pk", url: "https://www.supremecourt.gov.pk/" }
      },
      {
        source: "Mst. Bilqis Fatima v Najmul Ikram — earlier West Pakistan High Court authority recognising Khula on judicial decree.",
        citation: "PLD 1959 (W.P.) Lah 566",
        access: { label: "PLD archive (print)", url: null }
      },
      {
        source: "Khurshid Bibi v Babu Khan — Supreme Court authority affirming dowry as the wife's exclusive proprietary interest.",
        citation: "PLD 1985 SC 38",
        access: { label: "supremecourt.gov.pk", url: "https://www.supremecourt.gov.pk/" }
      },
      {
        source: "Muhammad Iqbal v Mst Khurshid Bibi — Supreme Court on the scope of declaratory suits against public authorities under Section 42 SRA 1877.",
        citation: "1990 SCMR 1057",
        access: { label: "supremecourt.gov.pk", url: "https://www.supremecourt.gov.pk/" }
      },
      {
        source: "Hafiz Tassaduq Hussain v Muhammad Din — Supreme Court restatement of principles governing mandatory injunctions under Section 55 SRA 1877.",
        citation: "PLD 2011 SC 241",
        access: { label: "supremecourt.gov.pk", url: "https://www.supremecourt.gov.pk/" }
      },
      {
        source: "Muhammad Ramzan v Mst Razia Begum — High Court authority on the quantum of maintenance assessed against husband's means under MFLO §9.",
        citation: "2014 YLR 254",
        access: { label: "pakistanlawsite.com", url: "https://www.pakistanlawsite.com/" }
      }
    ]),
    blank(),
    para(run("Subscription database for comprehensive Pakistani case search:"), { alignment: AlignmentType.LEFT }),
    para([
      run("•  "),
      hyperlink("https://www.pakistanlawsite.com/", "https://www.pakistanlawsite.com/"),
      run(" — comprehensive Pakistani case-law database; institutional access typically available through Pakistani universities.")
    ]),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 6. TEXTBOOK / TREATISE AUTHORITIES
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("6.  Textbook and Treatise Authorities"),

    para(run("The drafting forms in our templates follow the recognised Pakistani and sub-continental treatises listed below. These are split into two groups: those that are canonical and universally available, and those that should be physically verified at the GIFT University Law Library before being cited in the final report.")),

    researchHeading2("6.1  Canonical Authorities (universally cited)"),

    referenceTable([
      {
        source: "Mulla, The Code of Civil Procedure — universal commentary on CPC 1908. The single most-cited CPC authority across South Asia. Recommended forms in Mulla underlie the plaint structure of our civil declaration template.",
        citation: "D.F. Mulla; LexisNexis (current editions)",
        access: { label: "lexisnexis.in (current editions)", url: "https://store.lexisnexis.in/" }
      },
      {
        source: "Mulla, Principles of Mahomedan Law — foundational treatise on Islamic personal law. Section 285 (dowry as wife's exclusive property) underlies our Dowry Recovery template. Editions edited by Justice M. Hidayatullah are the universal citation.",
        citation: "D.F. Mulla (Hidayatullah ed.); LexisNexis",
        access: { label: "Internet Archive (older editions free)", url: "https://archive.org/" }
      }
    ]),

    blank(),

    researchHeading2("6.2  Pakistani Drafting Authorities (verify at GIFT Law Library)"),

    para(run("These are commonly named as standard Pakistani drafting authorities. They are cited in our generator's code comments and in LEGAL-BASIS.md. Before final report submission, please physically locate each title on the GIFT Law Library shelf, note the exact edition and ISBN, and update the citation in the bibliography. If a title is not stocked at GIFT, fall back on Mulla and the statutes — that is already a defensible bibliographic foundation.")),
    blank(),

    referenceTable([
      {
        source: "Justice (R.) Dr. Tanzil-ur-Rahman, A Code of Muslim Personal Law — Vols. I and II. Author was Chief Justice of the Federal Shariat Court of Pakistan (1990–1992). Forms K-1, M-1, and D-1 underlie our Khula, Maintenance, and Dowry templates respectively.",
        citation: "Hamdard Foundation Press, Karachi (~1978–1980)",
        access: { label: "Verify at GIFT Law Library", url: null }
      },
      {
        source: "Aamer Raza A. Khan, Drafting, Pleadings and Conveyancing — Pakistani practitioner's manual. Form D-3 (declaration suits against public authorities) underlies our civil declaration template.",
        citation: "Pakistani legal publishers",
        access: { label: "Verify at GIFT Law Library", url: null }
      },
      {
        source: "Manzoor Hussain Sial, Drafting and Pleadings — practitioner's handbook used as cross-reference for verification and supporting-document page conventions.",
        citation: "Pakistani legal publishers",
        access: { label: "Verify at GIFT Law Library", url: null }
      }
    ]),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 7. RELIGIOUS AND CONSTITUTIONAL BASIS
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("7.  Religious and Constitutional Basis"),

    researchHeading2("7.1  Constitution of the Islamic Republic of Pakistan, 1973"),
    para(run("Article 2A (Objectives Resolution made substantive) requires all laws in Pakistan to be in conformity with the injunctions of Islam. This is the constitutional foundation for the Islamic underpinnings of our family-law templates — Khula, maintenance, and dowry recovery.")),
    para([
      run("🌐  Full text:  "),
      hyperlink("https://www.na.gov.pk/uploads/documents/1333523681_951.pdf", "https://www.na.gov.pk/uploads/documents/1333523681_951.pdf"),
      run(" — National Assembly of Pakistan official copy.")
    ]),
    blank(),

    researchHeading2("7.2  Quranic Foundation (Islamic Family Law)"),
    para(run("Where Pakistani family-law statutes leave matters to Muslim personal law, the substantive rights derive from the Holy Quran. The verses underlying our family templates are:")),
    bulletPara("Surah Al-Baqarah 2:229 — basis for Khula (wife's right to seek dissolution upon returning the Mahr)."),
    bulletPara("Surah Al-Baqarah 2:233 — \"upon the father is their provision and their clothing.\" Husband's maintenance obligation."),
    bulletPara("Surah Al-Talaq 65:6 — \"lodge them where you dwell.\" Husband's duty of residence/maintenance."),
    blank(),
    para([
      run("Online Quran with translation: "),
      hyperlink("https://quran.com/", "https://quran.com/"),
      run(" — searchable text in Arabic with multiple English translations.")
    ]),
    blank(),

    researchHeading2("7.3  Hadith of Jamila bint Abdullah (Sahih Bukhari)"),
    para(run("The first reported case of Khula in Islamic history — the wife of Thabit ibn Qais sought dissolution before the Holy Prophet (peace be upon him), who directed her to return the orchard she had received as Mahr and pronounced the dissolution. This forms the jurisprudential basis for Khula in Pakistani Muslim personal law.")),
    para([
      run("Reference: "),
      hyperlink("https://sunnah.com/bukhari/68/13", "https://sunnah.com/bukhari/68/13"),
      run(" — Sahih al-Bukhari Book of Divorce.")
    ]),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 8. TEMPLATE-BY-TEMPLATE LEGAL MAPPING
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("8.  Template-by-Template Legal Mapping"),
    para(run("Each of the four implemented templates maps to a specific bundle of Pakistani statutes, case law, and drafting forms. The mappings below allow any paragraph of any template to be traced back to its legal anchor.")),

    researchHeading2("8.1  family/family_khula.docx — Suit for Dissolution of Marriage on basis of Khula"),
    para(run("Statutory anchors:")),
    bulletPara("Dissolution of Muslim Marriages Act 1939 (Act VIII of 1939) — Section 2 grounds for dissolution (Khula read into framework via case law)."),
    bulletPara("Muslim Family Laws Ordinance 1961, Section 5 — registration of Nikah (paragraph 2 of the plaint)."),
    bulletPara("Family Courts Act 1964, Sections 5 and 7 — jurisdiction and Schedule of witnesses/documents."),
    bulletPara("CPC 1908, Order VII Rule 1 — particulars in plaint."),
    para(run("Case-law anchor:")),
    bulletPara("Khurshid Bibi v Muhammad Amin, PLD 1967 SC 97 — Supreme Court establishment of Khula as judicial right."),
    para(run("Drafting form:")),
    bulletPara("Tanzil-ur-Rahman, A Code of Muslim Personal Law, Vol. I, Form K-1 (Khula)."),
    para(run("Quranic / Hadith basis:")),
    bulletPara("Quran 2:229; Hadith of Jamila bint Abdullah, Sahih al-Bukhari, Book of Divorce."),

    blank(),
    researchHeading2("8.2  family/family_maintenance.docx — Suit for Recovery of Maintenance"),
    para(run("Statutory anchors:")),
    bulletPara("Muslim Family Laws Ordinance 1961, Section 9 — maintenance obligation (paras 8 and 10 of the plaint)."),
    bulletPara("Muslim Family Laws Ordinance 1961, Section 6 — Arbitration Council permission for second marriage (relevant when claim is anchored on unauthorised second marriage)."),
    bulletPara("Family Courts Act 1964, Section 5 read with Schedule entry on maintenance."),
    bulletPara("Family Courts Act 1964, Section 7(2) — Schedule of witnesses and documents."),
    para(run("Case-law authorities:")),
    bulletPara("Muhammad Ramzan v Mst Razia Begum, 2014 YLR 254 — quantum of maintenance based on husband's means."),
    para(run("Drafting form:")),
    bulletPara("Tanzil-ur-Rahman, A Code of Muslim Personal Law, Vol. II, Form M-1 (Maintenance)."),
    para(run("Quranic basis:")),
    bulletPara("Quran 2:233; Quran 65:6 — husband's duty of provision and lodging."),

    blank(),
    researchHeading2("8.3  family/family_dowry_recovery.docx — Suit for Recovery of Dowry Articles"),
    para(run("Statutory anchors:")),
    bulletPara("Dowry and Bridal Gifts (Restriction) Act 1976 (Act XLIII of 1976) — dowry as wife's exclusive property; actionable for recovery."),
    bulletPara("Family Courts Act 1964, Section 5 read with Schedule (entries on dowry / personal property of wife)."),
    bulletPara("Family Courts Act 1964, Section 7(2)."),
    bulletPara("Muslim Family Laws Ordinance 1961, Section 5 — marriage registration."),
    para(run("Case-law anchors:")),
    bulletPara("Khurshid Bibi v Babu Khan, PLD 1985 SC 38 — Supreme Court affirmation that dowry is wife's exclusive property."),
    para(run("Drafting form:")),
    bulletPara("Tanzil-ur-Rahman, A Code of Muslim Personal Law, Vol. II, Form D-1 (Dowry / Stridhan recovery)."),
    para(run("Treatise authority:")),
    bulletPara("Mulla, Principles of Mahomedan Law, §285 — substantive proposition cited in paragraph 5 of the plaint."),

    blank(),
    researchHeading2("8.4  civil/civil_declaration.docx — Suit for Declaration and Mandatory Injunction"),
    para(run("Statutory anchors:")),
    bulletPara("Specific Relief Act 1877, Section 42 — declaratory decree (basis for prayer clauses (a)–(c))."),
    bulletPara("Specific Relief Act 1877, Section 55 — mandatory injunction (basis for prayer clause (d))."),
    bulletPara("CPC 1908, Section 9 — jurisdiction of civil courts."),
    bulletPara("CPC 1908, Order VII Rule 1 — particulars in plaint; Order VI Rule 15 — verification."),
    bulletPara("Court Fees Act 1870, Schedule II Article 17(iii) — court fee for declaratory suits."),
    bulletPara("Suits Valuation Act 1887, Section 4."),
    para(run("Case-law authorities:")),
    bulletPara("Muhammad Iqbal v Mst Khurshid Bibi, 1990 SCMR 1057 — declaratory suits against public authorities."),
    bulletPara("Hafiz Tassaduq Hussain v Muhammad Din, PLD 2011 SC 241 — mandatory injunction principles."),
    para(run("Drafting form:")),
    bulletPara("Mulla, The Code of Civil Procedure, commentary on Order VII Rule 1."),
    bulletPara("Aamer Raza A. Khan, Drafting Pleadings and Conveyancing, Form D-3 (declaration against public authority)."),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 9. ADVOCATE REFERENCE MATERIALS
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("9.  Advocate-Supplied Reference Drafts"),

    para(run("Three actual Pakistani court plaints supplied by a consulting advocate form the immediate practical reference for paragraph structure and language. These should be preserved as appendix material in the FYP submission as primary evidence of current Pakistani drafting practice.")),
    blank(),
    bulletPara("Khula Suit.pdf — Suit for Dissolution of Marriage on basis of Khula. Filed in the Court of Senior Civil Judge / Family Judge, Lahore (2017). Drafted by Just & Right Law Company. Used to derive family_khula.docx."),
    bulletPara("Suit for Recovery of Maintenance and Dowery Articles.pdf — Combined maintenance + dowry plaint. Filed in IIIrd Family Judge, Karachi South. Drafted by Advocate S.M. Zubair. Used (after splitting into two distinct relief-types) to derive family_maintenance.docx and family_dowry_recovery.docx."),
    bulletPara("Muhammad Zulfiqar Civil Suit.pdf — Suit for Declaration and Mandatory Injunction (correction of marriage-certificate entries). Filed in the Court of Senior Civil Judge, Gujranwala (2026). Drafted by Advocate Waqas Ahmad Goraya. Used to derive civil_declaration.docx."),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 10. ONLINE LEGAL RESOURCES
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("10.  Online Legal Resources (consolidated)"),

    researchHeading2("10.1  Official Government Portals"),
    para([
      run("•  "),
      hyperlink("https://pakistancode.gov.pk/", "https://pakistancode.gov.pk/"),
      run("  —  Official Pakistan Code (federal statutes).")
    ]),
    para([
      run("•  "),
      hyperlink("https://punjabcode.punjab.gov.pk/", "https://punjabcode.punjab.gov.pk/"),
      run("  —  Punjab Code (provincial laws of Punjab).")
    ]),
    para([
      run("•  "),
      hyperlink("https://www.supremecourt.gov.pk/", "https://www.supremecourt.gov.pk/"),
      run("  —  Supreme Court of Pakistan (judgments, search).")
    ]),
    para([
      run("•  "),
      hyperlink("https://www.federalshariatcourt.gov.pk/", "https://www.federalshariatcourt.gov.pk/"),
      run("  —  Federal Shariat Court (Islamic-law judgments).")
    ]),
    para([
      run("•  "),
      hyperlink("https://www.lhc.gov.pk/", "https://www.lhc.gov.pk/"),
      run("  —  Lahore High Court (judgments, search).")
    ]),
    para([
      run("•  "),
      hyperlink("https://www.na.gov.pk/", "https://www.na.gov.pk/"),
      run("  —  National Assembly of Pakistan (legislative history; Constitution).")
    ]),

    researchHeading2("10.2  Case-law Databases"),
    para([
      run("•  "),
      hyperlink("https://www.pakistanlawsite.com/", "https://www.pakistanlawsite.com/"),
      run("  —  Subscription database, comprehensive Pakistani case search (institutional access).")
    ]),
    para([
      run("•  "),
      hyperlink("https://pldpublishers.com/", "https://pldpublishers.com/"),
      run("  —  Pakistan Legal Decisions (PLD) — official law-report publisher.")
    ]),
    para([
      run("•  "),
      hyperlink("https://plj.pk/", "https://plj.pk/"),
      run("  —  Pakistan Law Journal (PLJ).")
    ]),

    researchHeading2("10.3  Textbook Sources"),
    para([
      run("•  "),
      hyperlink("https://store.lexisnexis.in/", "https://store.lexisnexis.in/"),
      run("  —  LexisNexis India (catalog of Mulla's CPC and Mahomedan Law editions).")
    ]),
    para([
      run("•  "),
      hyperlink("https://archive.org/", "https://archive.org/"),
      run("  —  Internet Archive (free downloads of older public-domain editions of Mulla's Mahomedan Law).")
    ]),
    para([
      run("•  "),
      hyperlink("https://books.google.com/", "https://books.google.com/"),
      run("  —  Google Books (search-preview for most legal treatises).")
    ]),

    researchHeading2("10.4  Religious Sources"),
    para([
      run("•  "),
      hyperlink("https://quran.com/", "https://quran.com/"),
      run("  —  Searchable Quran in Arabic with multiple English translations.")
    ]),
    para([
      run("•  "),
      hyperlink("https://sunnah.com/", "https://sunnah.com/"),
      run("  —  Searchable Hadith collections (Sahih al-Bukhari, Muslim, etc.).")
    ]),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 11. CITATION FORMAT GUIDE
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("11.  Citation Format Guide"),

    para(run("Pakistani legal academia follows a hybrid of OSCOLA (Oxford Standard Citation of Legal Authorities) and the PLD reporting convention. Accepted formats for the FYP report:")),
    blank(),

    researchHeading2("11.1  Statutes"),
    para(run("Family Courts Act 1964, s. 7(2).")),
    para(run("Specific Relief Act 1877, ss. 42 and 55.")),
    para(run("Muslim Family Laws Ordinance 1961, s. 9.")),
    blank(),

    researchHeading2("11.2  Case Law"),
    para(run("Khurshid Bibi v Muhammad Amin, PLD 1967 SC 97.")),
    para(run("Hafiz Tassaduq Hussain v Muhammad Din, PLD 2011 SC 241.")),
    blank(),

    researchHeading2("11.3  Textbooks"),
    para(run("Mulla, The Code of Civil Procedure (LexisNexis, current edn.), Order VII Rule 1.")),
    para(run("Mulla, Principles of Mahomedan Law (Hidayatullah edn., LexisNexis), §285.")),
    para(run("Tanzil-ur-Rahman, A Code of Muslim Personal Law, Vol I, Form K-1.")),
    blank(),

    researchHeading2("11.4  Quranic Verses"),
    para(run("Quran 2:229 (basis for Khula).")),
    para(run("Quran 2:233 and Quran 65:6 (husband's maintenance obligation).")),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 12. VERIFICATION CHECKLIST
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("12.  Verification Checklist (for FYP viva preparation)"),

    para(run("Before the report goes for binding, work through this checklist so every citation is independently verifiable:")),
    blank(),
    bulletPara("□  For each statute cited, open pakistancode.gov.pk and locate the Act. Note the URL of the landing page."),
    bulletPara("□  For each case cited, search supremecourt.gov.pk or pakistanlawsite.com (institutional login). Confirm the citation."),
    bulletPara("□  Visit the GIFT University Law Library. Locate physical copies of: Mulla's CPC, Mulla's Mahomedan Law, Tanzil-ur-Rahman's Code of Muslim Personal Law. Note the exact edition number, publisher, year, and ISBN of each."),
    bulletPara("□  If Tanzil-ur-Rahman / Aamer Raza Khan / Manzoor Hussain Sial are not stocked at GIFT, drop their citations from the bibliography and rely on Mulla + the statutes + the advocate-supplied PDFs."),
    bulletPara("□  Verify that the three advocate-supplied PDFs are included in the FYP submission as appendix material, with the consulting advocate named."),
    bulletPara("□  Bookmark pakistancode.gov.pk and supremecourt.gov.pk on the viva-presentation laptop for quick reference during questions."),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 13. PENDING TEMPLATES (LEGAL ANCHORS PRE-MAPPED)
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("13.  Pending Templates — Pre-Mapped Legal Anchors"),

    para(run("Six of the ten supported case types are pending receipt of advocate-supplied reference drafts. To minimise downstream research effort, the legal anchors for each are pre-mapped below. When reference drafts are received, the templates can be added to the generator without further bibliographic work.")),
    blank(),
    bulletPara("civil_recovery_of_money — CPC 1908 + Contract Act 1872. Drafting form: Mulla on CPC, Form 1."),
    bulletPara("civil_permanent_injunction — Specific Relief Act 1877, Sections 38, 39, 54. Drafting form: Aamer Raza Khan, Form I-1."),
    bulletPara("civil_specific_performance — Specific Relief Act 1877, Sections 12 and 22. Drafting form: Mulla on CPC, Form 47."),
    bulletPara("civil_possession_of_property — CPC 1908, Sections 9 and 16; Specific Relief Act 1877, Sections 8 and 9. Drafting form: Mulla on CPC, Form 28."),
    bulletPara("family_minor_custody — Guardians and Wards Act 1890; Family Courts Act 1964 Section 5 Schedule. Drafting form: Tanzil-ur-Rahman, Vol. I, Form H-1."),
    bulletPara("family_conjugal_rights — Family Courts Act 1964 Section 5 Schedule; Muslim Personal Law. Drafting form: Tanzil-ur-Rahman, Vol. I, Form R-1."),

    pageBreak(),

    // ═══════════════════════════════════════════════════════════════════════
    // 14. BIBLIOGRAPHY (consolidated)
    // ═══════════════════════════════════════════════════════════════════════
    researchHeading1("14.  Consolidated Bibliography"),

    researchHeading2("14.1  Statutes (Pakistan)"),
    bulletPara("Civil Procedure Code, 1908 (Act V of 1908)."),
    bulletPara("Specific Relief Act, 1877 (Act I of 1877)."),
    bulletPara("Court Fees Act, 1870 (Act VII of 1870)."),
    bulletPara("Suits Valuation Act, 1887 (Act VII of 1887)."),
    bulletPara("Dissolution of Muslim Marriages Act, 1939 (Act VIII of 1939)."),
    bulletPara("Muslim Family Laws Ordinance, 1961 (Ord. VIII of 1961)."),
    bulletPara("Family Courts Act, 1964 (Act XXXV of 1964)."),
    bulletPara("Guardians and Wards Act, 1890 (Act VIII of 1890)."),
    bulletPara("Dowry and Bridal Gifts (Restriction) Act, 1976 (Act XLIII of 1976)."),
    bulletPara("Constitution of the Islamic Republic of Pakistan, 1973."),

    researchHeading2("14.2  Case Law"),
    bulletPara("Khurshid Bibi v Muhammad Amin, PLD 1967 SC 97."),
    bulletPara("Mst. Bilqis Fatima v Najmul Ikram, PLD 1959 (W.P.) Lah 566."),
    bulletPara("Khurshid Bibi v Babu Khan, PLD 1985 SC 38."),
    bulletPara("Muhammad Iqbal v Mst Khurshid Bibi, 1990 SCMR 1057."),
    bulletPara("Hafiz Tassaduq Hussain v Muhammad Din, PLD 2011 SC 241."),
    bulletPara("Muhammad Ramzan v Mst Razia Begum, 2014 YLR 254."),

    researchHeading2("14.3  Textbooks and Treatises"),
    bulletPara("Mulla, D.F., The Code of Civil Procedure (LexisNexis, current editions)."),
    bulletPara("Mulla, D.F., Principles of Mahomedan Law (Hidayatullah edn., LexisNexis)."),
    bulletPara("Tanzil-ur-Rahman, A Code of Muslim Personal Law, Vols. I & II (Hamdard Foundation Press, Karachi) — verify edition at GIFT Law Library."),
    bulletPara("Khan, Aamer Raza A., Drafting, Pleadings and Conveyancing — verify edition at GIFT Law Library."),
    bulletPara("Sial, Manzoor Hussain, Drafting and Pleadings — verify edition at GIFT Law Library."),

    researchHeading2("14.4  Religious Sources"),
    bulletPara("The Holy Quran (various translations)."),
    bulletPara("Sahih al-Bukhari, Book of Divorce (Hadith of Jamila bint Abdullah)."),

    researchHeading2("14.5  Advocate-Supplied Reference Plaints"),
    bulletPara("Khula Suit.pdf, Senior Civil Judge / Family Judge, Lahore (2017)."),
    bulletPara("Suit for Recovery of Maintenance and Dowery Articles.pdf, IIIrd Family Judge, Karachi South."),
    bulletPara("Muhammad Zulfiqar Civil Suit.pdf, Senior Civil Judge, Gujranwala (2026)."),

    blank(),
    blank(),
    centeredText("— end of research document —", { italics: true, color: SECTION_GRAY })
  ]);
}

// ──────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────
const TEMPLATES = [
  { dir: FAMILY_DIR, fileName: "family_khula.docx",            build: buildKhulaDocument },
  { dir: FAMILY_DIR, fileName: "family_maintenance.docx",      build: buildMaintenanceDocument },
  { dir: FAMILY_DIR, fileName: "family_dowry_recovery.docx",   build: buildDowryRecoveryDocument },
  { dir: CIVIL_DIR,  fileName: "civil_declaration.docx",       build: buildDeclarationDocument }
];

// The research document is a separate kind of artefact (academic reference,
// not a court plaint) — kept at the root of case-templates/ alongside
// LEGAL-BASIS.md so both human-readable references live together.
const RESEARCH_DOC = {
  dir: OUTPUT_DIR,
  fileName: "RESEARCH_DOCUMENT.docx",
  build: buildResearchDocument
};

async function main() {
  await fs.mkdir(CIVIL_DIR, { recursive: true });
  await fs.mkdir(FAMILY_DIR, { recursive: true });

  for (const { dir, fileName, build } of TEMPLATES) {
    const doc = build();
    const buffer = await Packer.toBuffer(doc);
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, buffer);
    const relative = path.relative(OUTPUT_DIR, filePath);
    console.log(`Generated: ${relative}  (${buffer.length} bytes)`);
  }

  // Research / reference document — generated last so it appears beneath the
  // template-generation lines in the output.
  {
    const doc = RESEARCH_DOC.build();
    const buffer = await Packer.toBuffer(doc);
    const filePath = path.join(RESEARCH_DOC.dir, RESEARCH_DOC.fileName);
    await fs.writeFile(filePath, buffer);
    const relative = path.relative(OUTPUT_DIR, filePath);
    console.log(`Generated: ${relative}  (${buffer.length} bytes)  — academic reference document`);
  }

  console.log(`\nDone. ${TEMPLATES.length} templates + 1 research document written under:`);
  console.log(`  ${OUTPUT_DIR}\n`);
  console.log("Pending (waiting on advocate reference drafts):");
  console.log("  civil/civil_recovery_of_money.docx");
  console.log("  civil/civil_permanent_injunction.docx");
  console.log("  civil/civil_specific_performance.docx");
  console.log("  civil/civil_possession_of_property.docx");
  console.log("  family/family_minor_custody.docx");
  console.log("  family/family_conjugal_rights.docx");
}

main().catch((err) => {
  console.error("Template generation failed:", err);
  process.exit(1);
});
