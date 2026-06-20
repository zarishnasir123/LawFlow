import { pool } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { findDiskTemplatePath } from "../cases/cases.service.js";
import {
  uploadCaseTypeTemplate,
  downloadCaseTypeTemplate,
  deleteCaseTypeTemplate,
} from "../../services/storage.service.js";

// The two tracks LawFlow supports at the tehsil level. Mirrors the
// case_types.category CHECK constraint; exported so the validator and any
// caller share one source of truth.
export const CASE_TYPE_CATEGORIES = ["civil", "family"];

// Turn a human display name into the kebab/snake fragment used in case_types.code.
// Lowercase, collapse any run of non-alphanumerics to a single underscore, trim
// stray underscores, and cap the length so `${category}_${slug}` stays well
// within the code column's 80 chars.
function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return slug || "type";
}

// Build a unique case_types.code for a new type: `${category}_${slug}`, with a
// numeric suffix (_2, _3, …) when the base already exists. Loops against the DB
// so two admins adding the same name don't collide.
async function generateUniqueCode(category, displayName) {
  const base = `${category}_${slugify(displayName)}`;
  let candidate = base;
  let n = 1;

  // Bounded loop — in practice resolves on the first or second try.
  while (n < 1000) {
    const existing = await pool.query(
      "SELECT 1 FROM case_types WHERE code = $1",
      [candidate]
    );
    if (existing.rowCount === 0) {
      return candidate;
    }
    n += 1;
    candidate = `${base}_${n}`;
  }

  throw new ApiError(500, "Could not generate a unique code for this case type");
}

function buildTemplateStatus({ hasCustom, hasDiskDefault }) {
  if (hasCustom) return "custom";
  if (hasDiskDefault) return "default";
  return "missing";
}

// Shape one case_types row (joined with its optional template + an in-use flag)
// into the admin-facing object. hasDiskDefault is computed by the caller (a
// filesystem check), since SQL can't see the on-disk built-in files.
function mapAdminCaseType(row, hasDiskDefault) {
  const hasCustom = row.has_custom_template === true;
  return {
    id: row.id,
    category: row.category,
    code: row.code,
    displayName: row.display_name,
    governingLaw: row.governing_law,
    sortOrder: row.sort_order,
    // The original 10 ship a .docx on disk; admin-added types never do — so a
    // disk default is exactly what makes a type "built-in".
    isBuiltIn: hasDiskDefault,
    inUse: row.in_use === true,
    caseCount: Number(row.case_count) || 0,
    templateStatus: buildTemplateStatus({ hasCustom, hasDiskDefault }),
    template: hasCustom
      ? {
          fileName: row.template_file_name,
          mimeType: row.template_mime_type,
          fileSize:
            row.template_file_size == null
              ? null
              : Number(row.template_file_size),
          updatedAt: row.template_updated_at,
        }
      : null,
  };
}

// GET /api/admin/case-types — every case type with its template status, a
// built-in flag, and whether any real case references it (blocks deletion).
export async function listCaseTypesForAdmin() {
  const result = await pool.query(
    `SELECT
       ct.id,
       ct.category,
       ct.code,
       ct.display_name,
       ct.governing_law,
       ct.sort_order,
       (ctt.id IS NOT NULL)                      AS has_custom_template,
       ctt.file_name                             AS template_file_name,
       ctt.mime_type                             AS template_mime_type,
       ctt.file_size                             AS template_file_size,
       ctt.updated_at                            AS template_updated_at,
       EXISTS (SELECT 1 FROM cases WHERE cases.case_type_id = ct.id) AS in_use,
       (SELECT COUNT(*) FROM cases WHERE cases.case_type_id = ct.id) AS case_count
     FROM case_types ct
     LEFT JOIN case_type_templates ctt ON ctt.case_type_id = ct.id
     ORDER BY ct.category, ct.sort_order, ct.display_name`
  );

  // Resolve the on-disk built-in check per row (≤ a couple dozen rows).
  const mapped = await Promise.all(
    result.rows.map(async (row) => {
      const diskPath = await findDiskTemplatePath(row.category, row.code);
      return mapAdminCaseType(row, diskPath !== null);
    })
  );

  return mapped;
}

// Fetch a single admin-shaped case type (used to return the fresh row after a
// mutation). Returns null when the id doesn't exist.
async function getAdminCaseTypeById(caseTypeId) {
  const result = await pool.query(
    `SELECT
       ct.id,
       ct.category,
       ct.code,
       ct.display_name,
       ct.governing_law,
       ct.sort_order,
       (ctt.id IS NOT NULL)                      AS has_custom_template,
       ctt.file_name                             AS template_file_name,
       ctt.mime_type                             AS template_mime_type,
       ctt.file_size                             AS template_file_size,
       ctt.updated_at                            AS template_updated_at,
       EXISTS (SELECT 1 FROM cases WHERE cases.case_type_id = ct.id) AS in_use,
       (SELECT COUNT(*) FROM cases WHERE cases.case_type_id = ct.id) AS case_count
     FROM case_types ct
     LEFT JOIN case_type_templates ctt ON ctt.case_type_id = ct.id
     WHERE ct.id = $1`,
    [caseTypeId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  const diskPath = await findDiskTemplatePath(row.category, row.code);
  return mapAdminCaseType(row, diskPath !== null);
}

// POST /api/admin/case-types — add a new case type under civil/family. It has
// no template yet, so it stays hidden from lawyers (Chunk 3) until one is
// uploaded.
export async function createCaseType({ category, displayName, governingLaw }) {
  const code = await generateUniqueCode(category, displayName);

  const next = await pool.query(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM case_types WHERE category = $1",
    [category]
  );
  const sortOrder = next.rows[0].next;

  const inserted = await pool.query(
    `INSERT INTO case_types (category, code, display_name, governing_law, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [category, code, displayName.trim(), governingLaw?.trim() || null, sortOrder]
  );

  return getAdminCaseTypeById(inserted.rows[0].id);
}

// Confirm a case type exists; 404 otherwise. Returns the raw row (id, category,
// code) for callers that need the path identifiers.
async function requireCaseTypeRow(caseTypeId) {
  const result = await pool.query(
    "SELECT id, category, code FROM case_types WHERE id = $1",
    [caseTypeId]
  );
  if (result.rowCount === 0) {
    throw new ApiError(404, "Case type not found");
  }
  return result.rows[0];
}

// POST /api/admin/case-types/:id/template — upload (or replace) the .docx
// template for a case type. Uploads to Supabase first, then upserts the
// pointer row (one row per type, so a replace overwrites in place).
export async function uploadTemplateForCaseType({
  caseTypeId,
  file,
  adminUserId,
}) {
  await requireCaseTypeRow(caseTypeId);

  if (!file || !file.buffer) {
    throw new ApiError(400, "A Word document (.docx) is required");
  }

  const uploaded = await uploadCaseTypeTemplate({
    caseTypeId,
    fileBuffer: file.buffer,
    mimeType: file.mimetype,
  });

  await pool.query(
    `INSERT INTO case_type_templates
       (case_type_id, storage_bucket, storage_path, file_name, mime_type, file_size, uploaded_by_user_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (case_type_id) DO UPDATE SET
       storage_bucket      = EXCLUDED.storage_bucket,
       storage_path        = EXCLUDED.storage_path,
       file_name           = EXCLUDED.file_name,
       mime_type           = EXCLUDED.mime_type,
       file_size           = EXCLUDED.file_size,
       uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
       updated_at          = NOW()`,
    [
      caseTypeId,
      uploaded.storageBucket,
      uploaded.storagePath,
      file.originalname || "template.docx",
      file.mimetype || null,
      typeof file.size === "number" ? file.size : null,
      adminUserId || null,
    ]
  );

  return getAdminCaseTypeById(caseTypeId);
}

// DELETE /api/admin/case-types/:id/template — remove an uploaded template,
// reverting the type to its built-in default (or "missing" for admin-added
// types). 404 when there's nothing uploaded to remove.
export async function removeTemplateForCaseType({ caseTypeId }) {
  await requireCaseTypeRow(caseTypeId);

  const existing = await pool.query(
    "SELECT storage_path FROM case_type_templates WHERE case_type_id = $1",
    [caseTypeId]
  );
  if (existing.rowCount === 0) {
    throw new ApiError(404, "There is no uploaded template to remove");
  }

  await pool.query(
    "DELETE FROM case_type_templates WHERE case_type_id = $1",
    [caseTypeId]
  );

  // Best-effort storage cleanup — an orphaned object is far better than failing
  // the admin's click after the DB row is already gone.
  await deleteCaseTypeTemplate(existing.rows[0].storage_path);

  return getAdminCaseTypeById(caseTypeId);
}

// DELETE /api/admin/case-types/:id — delete a case type entirely. Blocked with
// a clear 409 if any real case references it (history is never orphaned). On
// success the template row cascades and its storage object is swept.
export async function deleteCaseType({ caseTypeId }) {
  const caseType = await requireCaseTypeRow(caseTypeId);

  const inUse = await pool.query(
    "SELECT COUNT(*) AS count FROM cases WHERE case_type_id = $1",
    [caseTypeId]
  );
  const count = Number(inUse.rows[0].count) || 0;
  if (count > 0) {
    const phrase = count === 1 ? "1 case still uses" : `${count} cases still use`;
    throw new ApiError(
      409,
      `This case type can't be deleted because ${phrase} it.`
    );
  }

  // Grab the storage path before the row cascades away.
  const tpl = await pool.query(
    "SELECT storage_path FROM case_type_templates WHERE case_type_id = $1",
    [caseTypeId]
  );

  try {
    await pool.query("DELETE FROM case_types WHERE id = $1", [caseTypeId]);
  } catch (error) {
    // Belt-and-braces: a concurrent case insert could slip past the pre-check
    // and trip the FK. Surface it as the same clean 409.
    if (error?.code === "23503") {
      throw new ApiError(
        409,
        "This case type can't be deleted because cases still use it."
      );
    }
    throw error;
  }

  if (tpl.rowCount > 0) {
    await deleteCaseTypeTemplate(tpl.rows[0].storage_path);
  }

  return { id: caseTypeId, code: caseType.code };
}

// GET /api/admin/case-types/:id/template — resolve the bytes to preview. Serves
// the admin-uploaded version when present, else the built-in on-disk default.
// 404 when neither exists (an admin-added type with no upload yet). Returns a
// descriptor the controller streams.
export async function getCaseTypeTemplateForPreview(caseTypeId) {
  const caseType = await requireCaseTypeRow(caseTypeId);

  const custom = await pool.query(
    "SELECT storage_path, file_name FROM case_type_templates WHERE case_type_id = $1",
    [caseTypeId]
  );

  if (custom.rowCount > 0) {
    const buffer = await downloadCaseTypeTemplate(custom.rows[0].storage_path);
    if (!buffer) {
      throw new ApiError(502, "Template storage is unavailable right now");
    }
    return {
      source: "custom",
      buffer,
      fileName: custom.rows[0].file_name || `${caseType.code}.docx`,
    };
  }

  const diskPath = await findDiskTemplatePath(caseType.category, caseType.code);
  if (diskPath) {
    return {
      source: "default",
      filePath: diskPath,
      fileName: `${caseType.code}.docx`,
    };
  }

  throw new ApiError(404, "No template available to preview for this case type");
}
