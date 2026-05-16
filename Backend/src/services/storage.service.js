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
