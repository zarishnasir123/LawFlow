import path from "node:path";

import { getSupabaseClient, getSupabaseStorageConfig } from "../config/supabase.js";
import { ApiError } from "../utils/apiError.js";

const documentTypeToExtension = {
  law_degree: ".pdf",
  bar_license_card: ".jpg",
  bar_license_card_front: ".jpg",
  bar_license_card_back: ".jpg"
};

// Category + filename mapping. Each lawyer's documents are organized under
// lawyers/{lawyerKey}/{category}/{filename}.{ext} for scalability and easy
// per-lawyer cleanup. New categories (cnic, profile) can be added here
// without restructuring callers.
const documentLayout = {
  law_degree:             { category: "license", filename: "degree" },
  bar_license_card:       { category: "license", filename: "card" },
  bar_license_card_front: { category: "license", filename: "card-front" },
  bar_license_card_back:  { category: "license", filename: "card-back" }
};

function pickExtension(documentType, originalName, mimeType) {
  const fromName = originalName ? path.extname(originalName).toLowerCase() : "";
  if (fromName) {
    return fromName;
  }

  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";

  return documentTypeToExtension[documentType] || ".bin";
}

function getLayout(documentType) {
  return documentLayout[documentType] ?? { category: "misc", filename: documentType };
}

function buildStoragePath(lawyerKey, documentType, originalName, mimeType) {
  const extension = pickExtension(documentType, originalName, mimeType);
  const { category, filename } = getLayout(documentType);
  return `lawyers/${lawyerKey}/${category}/${filename}${extension}`;
}

export function getLawyerStorageRoot(lawyerKey) {
  return `lawyers/${lawyerKey}`;
}

// Recover the lawyerKey from any storage path produced by buildStoragePath.
// Lives here (not in auth.service.js) so the prefix convention has one owner —
// if buildStoragePath ever changes its shape, this helper changes alongside it.
export function parseLawyerKeyFromStoragePath(storagePath) {
  if (typeof storagePath !== "string") return null;
  const match = /^lawyers\/([^/]+)\//.exec(storagePath);
  return match ? match[1] : null;
}

export async function uploadLawyerDocument({ documentType, file, lawyerKey }) {
  if (!file || !file.buffer) {
    throw new ApiError(400, `Missing file for ${documentType}`);
  }

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new ApiError(
      503,
      `Document storage is not configured. Missing or placeholder values: ${config.issues.join(", ")}`
    );
  }

  const storagePath = buildStoragePath(
    lawyerKey,
    documentType,
    file.originalname,
    file.mimetype
  );

  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new ApiError(
      502,
      `Failed to upload ${documentType} to storage: ${error.message}`
    );
  }

  return {
    storageBucket: config.bucket,
    storagePath,
    fileName: file.originalname || null,
    mimeType: file.mimetype || null,
    fileSize: typeof file.size === "number" ? file.size : null,
    uploadedAt: new Date().toISOString()
  };
}

export async function getLawyerDocumentSignedUrl({ storagePath, expiresIn }) {
  if (!storagePath) {
    return null;
  }

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const ttl = Number.isFinite(expiresIn) && expiresIn > 0
    ? expiresIn
    : config.previewUrlExpiresIn;

  const { data, error } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(storagePath, ttl);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function deleteLawyerDocuments({ storagePaths }) {
  if (!Array.isArray(storagePaths) || storagePaths.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  const config = getSupabaseStorageConfig();
  const paths = storagePaths.filter(Boolean);

  const { error } = await supabase.storage
    .from(config.bucket)
    .remove(paths);

  if (error) {
    // Surface storage-cleanup failures to operational logs so orphaned files
    // can be reconciled. Log path count, not full paths, per AGENTS.md.
    console.error("[STORAGE CLEANUP FAILED]", {
      task: "delete-lawyer-documents",
      bucket: config.bucket,
      pathCount: paths.length,
      message: error.message
    });
  }
}

// =====================================================================
// Signed case-file PDFs.
//
// Separate from the verification-documents bucket because they have a
// different lifecycle (final artifact, not a draft upload) and
// different access rules (lawyer-only, never registrar). The bucket
// `case-signed-pdfs` is configured via SUPABASE_CASE_PDF_BUCKET.
// Path convention: lawyers/{lawyerUserId}/cases/{caseId}/signed.pdf.
// =====================================================================

function buildSignedCasePdfPath({ lawyerUserId, caseId }) {
  return `lawyers/${lawyerUserId}/cases/${caseId}/signed.pdf`;
}

export async function uploadSignedCasePdf({ lawyerUserId, caseId, pdfBuffer }) {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new ApiError(500, "Signed PDF buffer is empty");
  }

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new ApiError(
      503,
      `Signed-PDF storage is not configured. Missing or placeholder values: ${config.issues.join(", ")}`
    );
  }

  const storagePath = buildSignedCasePdfPath({ lawyerUserId, caseId });

  // upsert: true so a re-compile (e.g. lawyer-triggered) overwrites the
  // previous artifact in place rather than orphaning the old object.
  const { error } = await supabase.storage
    .from(config.casePdfBucket)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

  if (error) {
    throw new ApiError(
      502,
      `Failed to upload signed PDF to storage: ${error.message}`
    );
  }

  return { storagePath };
}

// =====================================================================
// User avatars (public bucket — see config/supabase.js for rationale)
// =====================================================================
//
// Path convention: users/{userId}/avatar.{ext} — one slot per user.
// `upsert: true` so re-uploading the avatar replaces the old object
// in place. We DON'T preserve old avatars; one per user is enough.

function buildAvatarPath({ userId, extension }) {
  const safeExt = (extension || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `users/${userId}/avatar.${safeExt || "png"}`;
}

export async function uploadUserAvatar({ userId, fileBuffer, mimeType, extension }) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new ApiError(400, "Avatar file is empty");
  }

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new ApiError(
      503,
      `Avatar storage is not configured. Missing or placeholder values: ${config.issues.join(", ")}`
    );
  }

  const storagePath = buildAvatarPath({ userId, extension });

  const { error } = await supabase.storage
    .from(config.avatarBucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType || "image/png",
      upsert: true,
      // Cache for an hour at the CDN; the frontend cache-busts via a
      // ?v=<updatedAt> query string so users see new avatars immediately
      // after upload.
      cacheControl: "3600"
    });

  if (error) {
    throw new ApiError(502, `Failed to upload avatar: ${error.message}`);
  }

  return { storagePath };
}

// Delete the user's avatar object from the bucket. Idempotent —
// missing files don't error out, since the caller may also be
// clearing the DB column when the file already happened to be gone.
// Used by the "Remove photo" flow on the profile edit page.
export async function deleteUserAvatar(storagePath) {
  if (!storagePath) return;

  const supabase = getSupabaseClient();
  if (!supabase) return; // best-effort: skip when Supabase isn't wired up

  const config = getSupabaseStorageConfig();
  // remove() takes an array of paths and returns { data, error }; a
  // missing object is reported as data only, not as an error, so we
  // don't need to special-case it here. We DO swallow real errors —
  // the source of truth is the DB column, and leaving an orphaned
  // object is a much better failure mode than blocking the user's
  // "Remove photo" click.
  await supabase.storage.from(config.avatarBucket).remove([storagePath]).catch(() => {});
}

// Render the public URL for a stored avatar. Kept around for any
// callers that opted into a public bucket; new code should prefer
// the signed-URL helper below since it works on private buckets too.
export function getUserAvatarPublicUrl(storagePath) {
  if (!storagePath) return null;

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = supabase.storage
    .from(config.avatarBucket)
    .getPublicUrl(storagePath);

  return data?.publicUrl || null;
}

// Generate a short-lived signed URL for the user's avatar. Works
// regardless of whether the bucket is configured public or private —
// the service role key bypasses RLS so we always get a URL the
// browser can load with <img src=…>.
//
// TTL = 1 hour. /auth/me runs on every page load and after mutation
// invalidations, so the URL refreshes well before expiry in normal
// use. Returns null when there's no avatar, Supabase isn't wired up,
// or the signed-URL request fails (we never want a missing avatar
// to crash the /auth/me response).
export async function getUserAvatarSignedUrl(storagePath, expiresInSeconds = 3600) {
  if (!storagePath) return null;

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds
    : 3600;

  const { data, error } = await supabase.storage
    .from(config.avatarBucket)
    .createSignedUrl(storagePath, ttl);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// Delete a compiled signed-PDF object from the case-signed-pdfs bucket.
// Best-effort + idempotent — a missing object is reported by Supabase as
// data-only (not an error), and we swallow real errors too. Used by the
// lawyer hard-delete-case flow to sweep the case's final artifact after
// the DB row (and its cascades) are gone. Leaving an orphan object behind
// is a far better failure mode than blocking / failing the delete.
export async function deleteSignedCasePdf(storagePath) {
  if (!storagePath) return;

  const supabase = getSupabaseClient();
  if (!supabase) return; // best-effort: skip when Supabase isn't wired up

  const config = getSupabaseStorageConfig();
  await supabase.storage
    .from(config.casePdfBucket)
    .remove([storagePath])
    .catch(() => {});
}

export async function getSignedCasePdfDownloadUrl({
  storagePath,
  expiresInSeconds
}) {
  if (!storagePath) return null;

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Short TTL — the lawyer's download CTA reads this then opens in a
  // new tab right away. 5 minutes is plenty for a click-to-download
  // flow and short enough that a leaked URL has minimal blast radius.
  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds
    : 300;

  const { data, error } = await supabase.storage
    .from(config.casePdfBucket)
    .createSignedUrl(storagePath, ttl);

  if (error || !data?.signedUrl) {
    return null;
  }

  return { downloadUrl: data.signedUrl, expiresInSeconds: ttl };
}

// Recursively lists every object under lawyers/{lawyerKey}/ and removes them.
// Used when a lawyer is rejected or when re-registering after a prior rejection.
export async function deleteLawyerStorageFolder({ lawyerKey }) {
  if (!lawyerKey) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const config = getSupabaseStorageConfig();
  const root = getLawyerStorageRoot(lawyerKey);

  const listPageSize = 100;

  async function collectPaths(prefix) {
    const collected = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase.storage
        .from(config.bucket)
        .list(prefix, { limit: listPageSize, offset });

      if (error) {
        console.error("[STORAGE CLEANUP FAILED]", {
          task: "list-lawyer-storage-folder",
          bucket: config.bucket,
          lawyerKey,
          message: error.message
        });
        return collected;
      }

      if (!Array.isArray(data) || data.length === 0) {
        return collected;
      }

      for (const entry of data) {
        const fullPath = `${prefix}/${entry.name}`;
        const isFolder = !entry.id && !entry.metadata;
        if (isFolder) {
          const children = await collectPaths(fullPath);
          collected.push(...children);
        } else {
          collected.push(fullPath);
        }
      }

      if (data.length < listPageSize) {
        return collected;
      }

      offset += listPageSize;
    }
  }

  const allPaths = await collectPaths(root);
  if (allPaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage
    .from(config.bucket)
    .remove(allPaths);

  if (error) {
    // Surface storage-cleanup failures so orphans can be reconciled. We log
    // the lawyerKey + path count, not the storage paths themselves, per
    // AGENTS.md's "private document URLs are not logged" rule.
    console.error("[STORAGE CLEANUP FAILED]", {
      task: "delete-lawyer-storage-folder",
      bucket: config.bucket,
      lawyerKey,
      pathCount: allPaths.length,
      message: error.message
    });
  }
}

// =====================================================================
// Case attachments (private bucket — see config/supabase.js).
//
// Path convention: cases/{caseId}/{attachmentId}/{safeFileName} so
// every attachment owns its own folder. Per-attachment folders make
// cleanup trivial (one prefix delete per row) and keep collisions
// impossible when two files share a name.
//
// The browser fetches via short-lived signed URLs (1-hour TTL). The
// editor's saved HTML contains those URLs literally, so on case re-
// open the frontend asks for a fresh batch from
// GET /cases/:caseId/attachments and rewrites the <img src> on the
// restored DOM. That's why a stable storage_path beats a baked-in
// URL: paths don't expire.
// =====================================================================

function safeAttachmentFileName(originalName) {
  // Strip path separators + control chars; keep the extension intact
  // so contentType detection works downstream. Defensive only — the
  // multer middleware also blocks weird names at the boundary.
  const fallback = "file";
  if (typeof originalName !== "string") return fallback;
  const base = originalName.replace(/[\\/\0\r\n]+/g, "").trim();
  if (!base) return fallback;
  return base.slice(0, 120);
}

function buildCaseAttachmentPath({ caseId, attachmentId, originalName }) {
  return `cases/${caseId}/${attachmentId}/${safeAttachmentFileName(originalName)}`;
}

export async function uploadCaseAttachment({
  caseId,
  attachmentId,
  fileBuffer,
  mimeType,
  originalName,
}) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new ApiError(400, "Attachment file is empty");
  }

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new ApiError(
      503,
      `Attachment storage is not configured. Missing or placeholder values: ${config.issues.join(", ")}`
    );
  }

  const storagePath = buildCaseAttachmentPath({
    caseId,
    attachmentId,
    originalName,
  });

  const { error } = await supabase.storage
    .from(config.caseAttachmentBucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType || "application/octet-stream",
      // upsert: false — each attachmentId is a fresh UUID, so we
      // never overwrite. A collision would mean a logic bug upstream
      // and should fail loudly rather than silently replace bytes.
      upsert: false,
    });

  if (error) {
    throw new ApiError(
      502,
      `Failed to upload case attachment: ${error.message}`
    );
  }

  return {
    storageBucket: config.caseAttachmentBucket,
    storagePath,
  };
}

export async function getCaseAttachmentSignedUrl(storagePath, expiresInSeconds = 3600) {
  if (!storagePath) return null;

  const config = getSupabaseStorageConfig();
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const ttl = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds
    : 3600;

  const { data, error } = await supabase.storage
    .from(config.caseAttachmentBucket)
    .createSignedUrl(storagePath, ttl);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteCaseAttachment(storagePath) {
  if (!storagePath) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const config = getSupabaseStorageConfig();
  // Best-effort cleanup — orphaning a storage object is far better
  // than blocking the user's delete click. Matches the avatar pattern.
  await supabase.storage
    .from(config.caseAttachmentBucket)
    .remove([storagePath])
    .catch(() => {});
}
