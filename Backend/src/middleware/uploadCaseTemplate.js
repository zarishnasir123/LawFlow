import multer from "multer";

import { ApiError } from "../utils/apiError.js";

// Single-file uploader for an admin-uploaded case-type template. 15 MB cap:
// a complete plaint/petition document with multiple sections can be a few MB
// once it carries formatting, but it should never be huge — this is a Word
// scaffold, not a media file.
const maxFileSizeBytes = 15 * 1024 * 1024;

// .docx only. The lawyer editor renders these through docx-preview, which
// only understands OOXML word documents — accepting a legacy .doc or a PDF
// here would just break the editor downstream, so we reject anything else at
// the edge.
const allowedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(_req, file, cb) {
    if (file.fieldname !== "template") {
      cb(new ApiError(400, `Unexpected upload field: ${file.fieldname}`));
      return;
    }

    const baseType = (file.mimetype || "").split(";")[0].trim();
    const isDocxName = /\.docx$/i.test(file.originalname || "");
    // Some browsers send a generic octet-stream for .docx; accept those when
    // the filename clearly ends in .docx, but reject everything else.
    const ok =
      allowedMimeTypes.has(baseType) ||
      (baseType === "application/octet-stream" && isDocxName);
    if (!ok) {
      cb(
        new ApiError(
          400,
          "Template must be a Word document (.docx)"
        )
      );
      return;
    }

    cb(null, true);
  },
});

const singleTemplate = uploader.single("template");

export function uploadCaseTemplate(req, res, next) {
  singleTemplate(req, res, (err) => {
    if (!err) return next();

    if (err instanceof ApiError) return next(err);

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ApiError(400, "Template is too large. Maximum size is 15 MB.")
        );
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(400, `Unexpected upload field: ${err.field}`));
      }
      return next(new ApiError(400, `Upload failed: ${err.message}`));
    }

    return next(err);
  });
}
