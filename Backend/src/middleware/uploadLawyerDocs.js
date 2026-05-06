import multer from "multer";

import { ApiError } from "../utils/apiError.js";

const maxFileSizeBytes = 10 * 1024 * 1024;

const allowedMimeByField = {
  degreeDocument: new Set(["application/pdf"]),
  licenseCardFrontImage: new Set(["image/jpeg", "image/png"]),
  licenseCardBackImage: new Set(["image/jpeg", "image/png"])
};

const fieldLabels = {
  degreeDocument: "Law degree document",
  licenseCardFrontImage: "Bar license card front picture",
  licenseCardBackImage: "Bar license card back picture"
};

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(_req, file, cb) {
    const allowed = allowedMimeByField[file.fieldname];

    if (!allowed) {
      cb(new ApiError(400, `Unexpected upload field: ${file.fieldname}`));
      return;
    }

    if (!allowed.has(file.mimetype)) {
      const expected = file.fieldname === "degreeDocument"
        ? "PDF"
        : "JPG or PNG";
      cb(new ApiError(400, `${fieldLabels[file.fieldname]} must be ${expected}`));
      return;
    }

    cb(null, true);
  }
});

const fieldsMiddleware = uploader.fields([
  { name: "degreeDocument", maxCount: 1 },
  { name: "licenseCardFrontImage", maxCount: 1 },
  { name: "licenseCardBackImage", maxCount: 1 }
]);

export function uploadLawyerDocs(req, res, next) {
  fieldsMiddleware(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof ApiError) {
      return next(err);
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(400, "Uploaded file is too large. Maximum size is 10 MB."));
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(400, `Unexpected upload field: ${err.field}`));
      }
      return next(new ApiError(400, `Upload failed: ${err.message}`));
    }

    return next(err);
  });
}
