import multer from "multer";

import { ApiError } from "../utils/apiError.js";

// Single-file uploader for case attachments — images the lawyer
// drags onto the docx editor canvas as floating overlays. 5 MB cap
// matches the lawyer-document path (CNIC scans / license cards live
// at similar resolutions). Larger than the avatar limit because
// evidence photos may carry useful detail at full size.
const maxFileSizeBytes = 5 * 1024 * 1024;

// Same closed set the floating-image renderer accepts: JPG + PNG.
// Anything else would render as a broken <img> at minimum and could
// drag in metadata / format quirks docx-preview's print path
// doesn't handle.
const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(_req, file, cb) {
    if (file.fieldname !== "file") {
      cb(new ApiError(400, `Unexpected upload field: ${file.fieldname}`));
      return;
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new ApiError(400, "Attachment must be a JPG or PNG image"));
      return;
    }

    cb(null, true);
  },
});

const singleAttachment = uploader.single("file");

export function uploadCaseAttachment(req, res, next) {
  singleAttachment(req, res, (err) => {
    if (!err) return next();

    if (err instanceof ApiError) return next(err);

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(400, "Attachment is too large. Maximum size is 5 MB."));
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(400, `Unexpected upload field: ${err.field}`));
      }
      return next(new ApiError(400, `Upload failed: ${err.message}`));
    }

    return next(err);
  });
}
