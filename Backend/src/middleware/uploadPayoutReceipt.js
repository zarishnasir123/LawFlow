import multer from "multer";

import { ApiError } from "../utils/apiError.js";

// Single-file uploader for a payout transfer receipt — the admin's proof of the
// manual bank transfer to a lawyer. Accepts an image (screenshot/photo of the
// bank confirmation) or a PDF receipt. 5 MB cap matches the other document
// upload paths.
const maxFileSizeBytes = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(_req, file, cb) {
    if (file.fieldname !== "receipt") {
      cb(new ApiError(400, `Unexpected upload field: ${file.fieldname}`));
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new ApiError(400, "Receipt must be a JPG, PNG, or PDF file"));
      return;
    }
    cb(null, true);
  },
});

const singleReceipt = uploader.single("receipt");

export function uploadPayoutReceipt(req, res, next) {
  singleReceipt(req, res, (err) => {
    if (!err) return next();

    if (err instanceof ApiError) return next(err);

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(400, "Receipt is too large. Maximum size is 5 MB."));
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(400, `Unexpected upload field: ${err.field}`));
      }
      return next(new ApiError(400, `Upload failed: ${err.message}`));
    }

    return next(err);
  });
}
