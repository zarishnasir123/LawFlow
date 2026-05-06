import path from "node:path";

import { getSupabaseClient, getSupabaseStorageConfig } from "../config/supabase.js";
import { ApiError } from "../utils/apiError.js";

const documentTypeToExtension = {
  law_degree: ".pdf",
  bar_license_card_front: ".jpg",
  bar_license_card_back: ".jpg"
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

function buildStoragePath(lawyerKey, documentType, originalName, mimeType) {
  const extension = pickExtension(documentType, originalName, mimeType);
  return `lawyers/pending/${lawyerKey}/${documentType}${extension}`;
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

  await supabase.storage
    .from(config.bucket)
    .remove(storagePaths.filter(Boolean))
    .catch(() => {
      // Best-effort cleanup; swallow errors so the original failure surfaces to the caller.
    });
}
