import multer from "multer";

import { ApiError } from "../utils/apiError.js";

// Single-file uploader for profile pictures. Smaller cap than the
// lawyer-document path (5 MB) — avatars don't need that much room and
// the storage footprint matters more here because EVERY user uploads
// one. 3 MB is comfortable headroom for typical phone-camera JPEGs
// after a light compression pass.
const maxFileSizeBytes = 3 * 1024 * 1024;

// JPG / PNG only. WebP and HEIC would be nice but Supabase Storage
// + the public-URL <img src> path is most reliable with the two
// universally-supported formats.
const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(_req, file, cb) {
    if (file.fieldname !== "avatar") {
      cb(new ApiError(400, `Unexpected upload field: ${file.fieldname}`));
      return;
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new ApiError(400, "Profile picture must be a JPG or PNG image"));
      return;
    }

    cb(null, true);
  }
});

// Single() because there's only ever one avatar at a time. The field
// name "avatar" matches what the frontend's FormData appends.
const singleAvatar = uploader.single("avatar");

export function uploadAvatar(req, res, next) {
  singleAvatar(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof ApiError) {
      return next(err);
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(400, "Profile picture is too large. Maximum size is 3 MB."));
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(400, `Unexpected upload field: ${err.field}`));
      }
      return next(new ApiError(400, `Upload failed: ${err.message}`));
    }

    return next(err);
  });
}
